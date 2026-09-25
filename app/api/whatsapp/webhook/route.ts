import { NextRequest } from "next/server";
import type { WhatsAppClient } from "@/lib/whatsappServer";
import {
  createWhatsAppClient,
  hashPairingCode,
  sendWhatsAppText,
  verifyMetaSignature,
} from "@/lib/whatsappServer";

export const runtime = "nodejs";
export const maxDuration = 20;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

async function sendSafely(to: string, text: string) {
  try {
    await sendWhatsAppText(to, text);
  } catch {
    // Do not expose provider credentials or personal phone numbers in webhook logs.
  }
}

async function linkWithCode(supabase: WhatsAppClient, phone: string, code: string) {
  const now = new Date().toISOString();
  const { data: link } = await supabase.from("sds_whatsapp_links")
    .select("user_id")
    .eq("pairing_code_hash", hashPairingCode(code))
    .gt("pairing_code_expires_at", now)
    .maybeSingle();
  if (!link) return false;

  const { error } = await supabase.from("sds_whatsapp_links")
    .update({
      phone_e164: phone,
      status: "active",
      consented_at: now,
      pairing_code_hash: null,
      pairing_code_expires_at: null,
      updated_at: now,
    })
    .eq("user_id", link.user_id);
  if (error) return false;
  await sendSafely(
    phone,
    "¡Listo! WhatsApp quedó vinculado con SÓCRATES DS. Tus píldoras llegarán en los horarios elegidos. Responde PAUSAR para detenerlas o CONTINUAR para retomarlas."
  );
  return true;
}

async function processTextMessage(
  supabase: WhatsAppClient,
  message: {
    id?: string;
    from?: string;
    type?: string;
    text?: { body?: string };
    context?: { id?: string };
  }
) {
  if (message.type !== "text" || !message.id || !message.from) return;
  const phone = normalizePhone(message.from);
  const body = (message.text?.body || "").trim();
  if (!phone || !body) return;

  if (/^(?:PAUSAR|STOP|BAJA)$/i.test(body)) {
    await supabase.from("sds_whatsapp_links")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("phone_e164", phone);
    await sendSafely(phone, "Pausé tus píldoras. Para retomarlas, responde CONTINUAR.");
    return;
  }

  if (/^(?:CONTINUAR|START|REANUDAR)$/i.test(body)) {
    const { error } = await supabase.from("sds_whatsapp_links")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("phone_e164", phone)
      .not("consented_at", "is", null);
    if (!error) await sendSafely(phone, "Listo, retomé tus píldoras de aprendizaje.");
    return;
  }

  const pairing = body.match(/^(?:VINCULAR|LINK)\s+(\d{6})$/i);
  if (pairing) {
    const linked = await linkWithCode(supabase, phone, pairing[1]);
    if (!linked) await sendSafely(phone, "Ese código venció o no coincide. Genera uno nuevo desde SÓCRATES DS.");
    return;
  }

  const { data: link } = await supabase.from("sds_whatsapp_links")
    .select("user_id,status")
    .eq("phone_e164", phone)
    .maybeSingle();
  if (!link || link.status !== "active") return;

  let prompt: {
    id: string;
    user_id: string;
    question_id: string | null;
    concept_id: string | null;
    course_id: string | null;
  } | null = null;
  if (message.context?.id) {
    const { data } = await supabase.from("sds_whatsapp_messages")
      .select("id,user_id,question_id,concept_id,course_id")
      .eq("meta_message_id", message.context.id)
      .eq("kind", "prompt")
      .eq("status", "sent")
      .eq("user_id", link.user_id)
      .maybeSingle();
    prompt = data;
  }
  if (!prompt) {
    const { data } = await supabase.from("sds_whatsapp_messages")
      .select("id,user_id,question_id,concept_id,course_id")
      .eq("user_id", link.user_id)
      .eq("kind", "prompt")
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    prompt = data;
  }
  if (!prompt) {
    await sendSafely(phone, "No veo una píldora pendiente. Cuando te llegue la próxima, respóndela aquí. Escribe PAUSAR para detener los recordatorios.");
    return;
  }

  const { data: existing } = await supabase.from("sds_whatsapp_messages")
    .select("id,attempt_id,status")
    .eq("meta_message_id", message.id)
    .maybeSingle();
  if (existing?.attempt_id) return;

  let inboundId = existing?.id;
  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from("sds_whatsapp_messages")
      .insert({
        user_id: link.user_id,
        direction: "inbound",
        kind: "reply",
        status: "received",
        body: body.slice(0, 8000),
        question_id: prompt.question_id,
        concept_id: prompt.concept_id,
        course_id: prompt.course_id,
        in_reply_to_id: prompt.id,
        meta_message_id: message.id,
        idempotency_key: "inbound:" + message.id,
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") return;
      throw insertError;
    }
    inboundId = inserted.id;
  }
  if (!inboundId) return;

  const staleAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase.from("sds_whatsapp_messages")
    .update({ status: "received", processing_at: null })
    .eq("id", inboundId)
    .eq("status", "processing")
    .lt("processing_at", staleAt);
  const { data: claimed } = await supabase.from("sds_whatsapp_messages")
    .update({ status: "processing", processing_at: new Date().toISOString() })
    .eq("id", inboundId)
    .eq("status", "received")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: question } = prompt.question_id
    ? await supabase.from("sds_question_bank")
        .select("course_id,concept_id")
        .eq("id", prompt.question_id)
        .maybeSingle()
    : { data: null };
  const { data: session, error: sessionError } = await supabase
    .from("sds_learning_sessions")
    .insert({
      user_id: link.user_id,
      course_id: question?.course_id || prompt.course_id,
      concept_id: question?.concept_id || prompt.concept_id,
      mode: "review",
      goal: "Recuperar y explicar un concepto mediante WhatsApp.",
      ended_at: new Date().toISOString(),
      metadata: {
        source: "whatsapp_scheduled_tutor",
        whatsapp_message_id: message.id,
        non_real_time_feedback: true,
      },
    })
    .select("id")
    .single();
  if (sessionError) {
    await supabase.from("sds_whatsapp_messages")
      .update({ status: "received", processing_at: null })
      .eq("id", inboundId);
    throw sessionError;
  }

  const { data: attempt, error: attemptError } = await supabase.from("sds_attempts")
    .insert({
      user_id: link.user_id,
      session_id: session.id,
      question_id: prompt.question_id,
      concept_id: prompt.concept_id,
      response_text: body.slice(0, 8000),
      self_score: null,
      confidence: null,
      feedback: "Respuesta recibida por WhatsApp; contraste formativo pendiente.",
    })
    .select("id")
    .single();
  if (attemptError) {
    await supabase.from("sds_whatsapp_messages")
      .update({ status: "received", processing_at: null })
      .eq("id", inboundId);
    throw attemptError;
  }

  await supabase.from("sds_whatsapp_messages")
    .update({
      status: "received",
      attempt_id: attempt.id,
      processing_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inboundId);
  await supabase.from("sds_whatsapp_messages")
    .update({ status: "answered", updated_at: new Date().toISOString() })
    .eq("id", prompt.id)
    .eq("status", "sent");
  await sendSafely(
    phone,
    "Recibí tu respuesta. La guardaré como evidencia y te enviaré el contraste en una de las próximas pasadas programadas."
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return json({ error: "webhook_verification_failed" }, 403);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return json({ error: "invalid_signature" }, 401);
  }
  let payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
            context?: { id?: string };
          }>;
        };
      }>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const messages = (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) => change.value?.messages || [])
  );
  if (!messages.length) return json({ received: true });
  try {
    const supabase = createWhatsAppClient();
    for (const message of messages) await processTextMessage(supabase, message);
    return json({ received: true });
  } catch {
    return json({ error: "message_processing_failed" }, 500);
  }
}
