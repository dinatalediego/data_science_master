import { NextRequest } from "next/server";
import {
  buildWhatsAppFeedback,
  createNovelPrompt,
  createWhatsAppClient,
  evaluateWhatsAppAnswer,
  hasWhatsAppConfiguration,
  limaDateKey,
  limaWeekday,
  localTimeMinutes,
  sendWhatsAppPrompt,
  sendWhatsAppText,
} from "@/lib/whatsappServer";

export const runtime = "nodejs";
export const maxDuration = 60;

type CourseTime = {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

function timeMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function isInsideClass(slot: number, weekday: number, courses: CourseTime[]) {
  return courses.some((course) =>
    Number(course.day_of_week) === weekday &&
    slot >= timeMinutes(course.start_time) &&
    slot < timeMinutes(course.end_time)
  );
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
}

async function updateMastery(
  supabase: ReturnType<typeof createWhatsAppClient>,
  userId: string,
  attemptId: string,
  conceptId: string | null,
  dimension: string,
  score: number,
  evaluatorConfidence: number
) {
  if (!conceptId) return;
  const { data: oldMastery } = await supabase.from("sds_mastery_states")
    .select("*")
    .eq("user_id", userId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  const oldExplanation =
    oldMastery?.explanation && typeof oldMastery.explanation === "object"
      ? oldMastery.explanation as Record<string, unknown>
      : {};
  if (oldExplanation.latest_attempt_id === attemptId) return;

  const nextReview = new Date();
  const intervalDays = score >= 0.8 ? 3 : 1;
  nextReview.setDate(nextReview.getDate() + intervalDays);
  const payload: Record<string, unknown> = {
    user_id: userId,
    concept_id: conceptId,
    stage: "explained",
    conceptual: oldMastery?.conceptual ?? null,
    mathematical: oldMastery?.mathematical ?? null,
    coding: oldMastery?.coding ?? null,
    transfer: oldMastery?.transfer ?? null,
    retention: oldMastery?.retention ?? null,
    confidence: oldMastery?.confidence ?? null,
    evidence_count: Number(oldMastery?.evidence_count || 0) + 1,
    last_evidence_at: new Date().toISOString(),
    next_review_at: nextReview.toISOString(),
    explanation: {
      ...oldExplanation,
      latest_source: "whatsapp_ai_evaluated_attempt",
      latest_attempt_id: attemptId,
      evaluator_confidence: evaluatorConfidence,
      warning: "Evidencia formativa no oficial; el score depende de una guía explícita.",
    },
  };
  if (["conceptual", "mathematical", "coding", "transfer", "retention"].includes(dimension)) {
    payload[dimension] = score;
  }
  const { error } = await supabase.from("sds_mastery_states")
    .upsert(payload, { onConflict: "user_id,concept_id" });
  if (error) throw error;

  const { error: reviewError } = await supabase.from("sds_review_items").insert({
    user_id: userId,
    concept_id: conceptId,
    due_at: nextReview.toISOString(),
    interval_days: intervalDays,
    reason: score >= 0.8
      ? "Repaso espaciado después de una respuesta de WhatsApp sólida."
      : "Recuperación temprana después de una respuesta de WhatsApp que requiere refuerzo.",
    status: "scheduled",
  });
  if (reviewError) throw reviewError;
}

async function processQueuedReplies(
  supabase: ReturnType<typeof createWhatsAppClient>
) {
  const staleAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase.from("sds_whatsapp_messages")
    .update({ status: "received", processing_at: null })
    .eq("kind", "reply")
    .eq("status", "processing")
    .lt("processing_at", staleAt);

  const { data: queued } = await supabase.from("sds_whatsapp_messages")
    .select("id,user_id,body,question_id,concept_id,course_id,attempt_id,in_reply_to_id,metadata")
    .eq("direction", "inbound")
    .eq("kind", "reply")
    .eq("status", "received")
    .not("attempt_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  for (const row of queued || []) {
    const { data: claimed } = await supabase.from("sds_whatsapp_messages")
      .update({ status: "processing", processing_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "received")
      .select("id")
      .maybeSingle();
    if (!claimed || !row.question_id || !row.attempt_id) continue;

    try {
      const { data: question, error: questionError } = await supabase
        .from("sds_question_bank")
        .select("prompt,answer_guide,dimension,difficulty")
        .eq("id", row.question_id)
        .single();
      if (questionError || !question?.answer_guide) throw new Error("answer_guide_unavailable");

      const [{ data: concept }, { data: course }, { data: promptMessage }] =
        await Promise.all([
          supabase.from("sds_concepts").select("title")
            .eq("id", row.concept_id).maybeSingle(),
          supabase.from("sds_courses").select("name")
            .eq("id", row.course_id).maybeSingle(),
          row.in_reply_to_id
            ? supabase.from("sds_whatsapp_messages").select("body")
                .eq("id", row.in_reply_to_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

      let evaluation = null;
      const { data: existingEvaluation } = await supabase
        .from("sds_attempt_evaluations")
        .select("id,score,evaluator_confidence,verdict,strengths,gaps,feedback,next_prompt,status")
        .eq("attempt_id", row.attempt_id)
        .eq("user_id", row.user_id)
        .order("evaluation_version", { ascending: false })
        .limit(1)
        .maybeSingle();
      evaluation = existingEvaluation;

      if (!evaluation) {
        const startedAt = Date.now();
        const generated = await evaluateWhatsAppAnswer({
          courseName: course?.name || "Maestría en Ciencia de Datos",
          conceptTitle: concept?.title || "Concepto del curso",
          referencePrompt: question.prompt,
          answerGuide: question.answer_guide,
          promptSent: promptMessage?.body || question.prompt,
          answer: row.body,
        });
        const { data: inserted, error: insertError } = await supabase
          .from("sds_attempt_evaluations")
          .insert({
            user_id: row.user_id,
            attempt_id: row.attempt_id,
            evaluation_version: 1,
            status: generated.verdict === "insufficient" ? "insufficient" : "completed",
            evaluator_type: "ai",
            score: generated.score,
            evaluator_confidence: generated.evaluatorConfidence,
            verdict: generated.verdict,
            strengths: generated.strengths,
            gaps: generated.gaps,
            feedback: generated.feedback,
            next_prompt: generated.nextPrompt,
            rubric: {
              reference: "question_answer_guide",
              question_dimension: question.dimension,
              question_difficulty: question.difficulty,
              non_official: true,
            },
            provider: "vercel-ai-gateway",
            model: process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol",
            latency_ms: Date.now() - startedAt,
          })
          .select("id,score,evaluator_confidence,verdict,strengths,gaps,feedback,next_prompt,status")
          .single();
        if (insertError) throw insertError;
        evaluation = inserted;
      }

      const attemptFeedback =
        "Contraste formativo. Respuesta " + (evaluation.verdict || "insufficient") +
        (evaluation.feedback ? ": " + evaluation.feedback : "");
      const { error: attemptUpdateError } = await supabase.from("sds_attempts")
        .update({ feedback: attemptFeedback.slice(0, 3000) })
        .eq("id", row.attempt_id)
        .eq("user_id", row.user_id);
      if (attemptUpdateError) throw attemptUpdateError;

      const trusted =
        evaluation.status === "completed" &&
        evaluation.score !== null &&
        Number(evaluation.evaluator_confidence || 0) >= 0.65;
      if (trusted) {
        await updateMastery(
          supabase,
          row.user_id,
          row.attempt_id,
          row.concept_id,
          question.dimension,
          Number(evaluation.score),
          Number(evaluation.evaluator_confidence)
        );
      }

      const fullFeedback = buildWhatsAppFeedback({
        score: evaluation.score === null ? null : Number(evaluation.score),
        evaluatorConfidence: Number(evaluation.evaluator_confidence || 0),
        verdict: (evaluation.verdict || "insufficient") as
          "strong" | "partial" | "weak" | "insufficient",
        strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths as string[] : [],
        gaps: Array.isArray(evaluation.gaps) ? evaluation.gaps as string[] : [],
        feedback: evaluation.feedback || "No hay evidencia suficiente para contrastar la respuesta.",
        nextPrompt: evaluation.next_prompt || "",
      });
      const { data: link } = await supabase.from("sds_whatsapp_links")
        .select("phone_e164,status")
        .eq("user_id", row.user_id)
        .maybeSingle();

      if (link?.phone_e164 && link.status === "active") {
        const metaId = await sendWhatsAppText(link.phone_e164, fullFeedback);
        const { error: feedbackError } = await supabase.from("sds_whatsapp_messages").insert({
          user_id: row.user_id,
          direction: "outbound",
          kind: "feedback",
          status: "sent",
          body: fullFeedback,
          question_id: row.question_id,
          concept_id: row.concept_id,
          course_id: row.course_id,
          attempt_id: row.attempt_id,
          in_reply_to_id: row.id,
          meta_message_id: metaId,
          idempotency_key: "feedback:" + row.id,
          sent_at: new Date().toISOString(),
        });
        if (feedbackError && feedbackError.code !== "23505") throw feedbackError;
      }
      await supabase.from("sds_whatsapp_messages").update({
        status: "evaluated",
        processing_at: null,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
          feedback_suppressed: Boolean(link?.phone_e164 && link.status !== "active"),
        },
      }).eq("id", row.id);
    } catch {
      await supabase.from("sds_whatsapp_messages")
        .update({ status: "received", processing_at: null })
        .eq("id", row.id)
        .eq("status", "processing");
    }
  }
}

async function selectQuestion(
  supabase: ReturnType<typeof createWhatsAppClient>,
  userId: string,
  slot: number
) {
  const [{ data: questions }, { data: attempts }, { data: dueReviews }, { data: mastery }, { data: recentMessages }] =
    await Promise.all([
      supabase.from("sds_question_bank")
        .select("id,prompt,answer_guide,dimension,difficulty,course_id,concept_id")
        .eq("active", true)
        .not("answer_guide", "is", null)
        .limit(100),
      supabase.from("sds_attempts").select("question_id,created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 45 * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("sds_review_items").select("concept_id")
        .eq("user_id", userId)
        .in("status", ["scheduled", "due"])
        .lte("due_at", new Date().toISOString())
        .limit(40),
      supabase.from("sds_mastery_states")
        .select("concept_id,conceptual,mathematical,coding,transfer,retention")
        .eq("user_id", userId),
      supabase.from("sds_whatsapp_messages").select("question_id,body")
        .eq("user_id", userId)
        .eq("kind", "prompt")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
  const usable = (questions || []).filter((question) =>
    typeof question.answer_guide === "string" && question.answer_guide.trim().length > 0
  );
  if (!usable.length) return null;

  const recentIds = new Set((attempts || []).map((item) => item.question_id).filter(Boolean));
  const recentPromptIds = new Set((recentMessages || []).map((item) => item.question_id).filter(Boolean));
  const recentTexts = (recentMessages || []).map((item) => item.body).filter(Boolean).slice(0, 6);
  const targetQuestion = slot === 13
    ? usable.find((item) => item.prompt.startsWith("Un lead llega ahora y el equipo quiere priorizar"))
    : null;
  let pool = usable.filter((item) => !recentIds.has(item.id) && !recentPromptIds.has(item.id));
  if (!pool.length) pool = usable.filter((item) => !recentPromptIds.has(item.id));
  if (!pool.length) pool = usable;

  const dueConcepts = new Set((dueReviews || []).map((item) => item.concept_id));
  const duePool = pool.filter((item) => dueConcepts.has(item.concept_id));
  if (duePool.length) {
    pool = duePool;
  } else {
    const weakConcepts = new Set((mastery || []).filter((item) => {
      const values = [item.conceptual, item.mathematical, item.coding, item.transfer, item.retention]
        .filter((value) => value !== null).map(Number);
      return values.length > 0 && Math.min(...values) < 0.65;
    }).map((item) => item.concept_id));
    const weakPool = pool.filter((item) => weakConcepts.has(item.concept_id));
    if (weakPool.length) pool = weakPool;
  }

  const chosen = targetQuestion || pool[Math.floor(Math.random() * pool.length)];
  const [{ data: concept }, { data: course }] = await Promise.all([
    chosen.concept_id
      ? supabase.from("sds_concepts").select("title,description")
          .eq("id", chosen.concept_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("sds_courses").select("name")
      .eq("id", chosen.course_id).maybeSingle(),
  ]);
  const courseName = course?.name || "Maestría en Ciencia de Datos";
  const conceptTitle = concept?.title || "Aprendizaje aplicado";
  let prompt = chosen.prompt;
  if (targetQuestion) {
    const targetVariants = [
      "Una empresa de software recibe una solicitud de demo. ¿Qué conversión futura definirías como y y qué dos campos que ya existen al enviar el formulario usarías como X?",
      "Un negocio de paneles solares recibe una solicitud de cotización. Define un outcome futuro como y y dos datos del formulario disponibles en ese instante como X; ¿qué dato posterior sería leakage?",
      "Una persona pide información sobre un programa de posgrado. ¿Qué matrícula futura pondrías como y y qué dos datos disponibles al crear ese lead usarías como X?",
      "Una inmobiliaria recibe un lead interesado en un departamento. ¿Qué evento futuro sería y y qué dos datos ya capturados en el primer contacto usarías como X?",
      "Una academia online recibe una consulta para un curso. Define una y observable a 30 días y dos X que ya conozcas al crear el lead; evita variables posteriores.",
      "Una empresa ofrece una evaluación gratuita de seguridad informática. ¿Qué resultado futuro usarías como y y qué dos campos presentes al crear el lead elegirías como X?"
    ];
    const seed = Array.from(userId).reduce((sum, char) => sum + char.charCodeAt(0), Number(limaDateKey().slice(-2)));
    prompt = targetVariants[seed % targetVariants.length];
  }
  try {
    prompt = await createNovelPrompt({
      courseName,
      conceptTitle,
      conceptDescription: concept?.description || "",
      referencePrompt: chosen.prompt,
      answerGuide: chosen.answer_guide,
      recentPrompts: recentTexts,
    });
  } catch {
    // Keep the curated question if AI variation is unavailable.
  }
  return { question: chosen, courseName, conceptTitle, prompt };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let supabase: ReturnType<typeof createWhatsAppClient>;
  try {
    supabase = createWhatsAppClient();
  } catch {
    return Response.json({ error: "server_configuration_missing" }, { status: 503 });
  }

  await processQueuedReplies(supabase);
  const slot = Number(new URL(request.url).searchParams.get("slot"));
  if (![11, 13, 17].includes(slot)) {
    return Response.json({ error: "invalid_slot" }, { status: 400 });
  }
  if (!hasWhatsAppConfiguration()) {
    return Response.json({ sent: 0, skipped: "whatsapp_not_configured" });
  }

  const weekday = limaWeekday();
  const nowMinutes = localTimeMinutes();
  const { data: courses } = await supabase.from("sds_courses")
    .select("id,name,day_of_week,start_time,end_time")
    .eq("active", true);
  if (isInsideClass(slot * 60, weekday, (courses || []) as CourseTime[])) {
    return Response.json({ sent: 0, skipped: "academic_class_in_progress" });
  }
  const { data: links, error: linkError } = await supabase.from("sds_whatsapp_links")
    .select("user_id,phone_e164,status,daily_frequency")
    .eq("status", "active");
  if (linkError) return Response.json({ error: "preferences_unavailable" }, { status: 503 });

  const today = limaDateKey();
  const sent: string[] = [];
  const skipped: Record<string, number> = {};
  for (const link of links || []) {
    const frequency = Number(link.daily_frequency || 0);
    const shouldSend =
      (slot === 13 && frequency >= 1) ||
      (slot === 17 && frequency >= 2) ||
      (slot === 11 && frequency >= 3);
    if (!shouldSend || !link.phone_e164) continue;

    const idempotencyKey = "prompt:" + link.user_id + ":" + today + ":" + slot;
    const { data: reservation, error: reserveError } = await supabase
      .from("sds_whatsapp_messages")
      .upsert(
        {
          user_id: link.user_id,
          direction: "outbound",
          kind: "prompt",
          status: "queued",
          body: "Píldora en preparación.",
          idempotency_key: idempotencyKey,
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();
    if (reserveError || !reservation) continue;

    const { data: openPrompt } = await supabase.from("sds_whatsapp_messages")
      .select("id")
      .eq("user_id", link.user_id)
      .eq("kind", "prompt")
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(1)
      .maybeSingle();
    if (openPrompt) {
      await supabase.from("sds_whatsapp_messages")
        .update({ status: "ignored", metadata: { reason: "unanswered_prompt" } })
        .eq("id", reservation.id);
      skipped.unanswered = (skipped.unanswered || 0) + 1;
      continue;
    }

    const selection = await selectQuestion(supabase, link.user_id, slot);
    if (!selection) {
      await supabase.from("sds_whatsapp_messages")
        .update({ status: "failed", metadata: { reason: "no_eligible_question" } })
        .eq("id", reservation.id);
      skipped.no_question = (skipped.no_question || 0) + 1;
      continue;
    }

    try {
      const metaId = await sendWhatsAppPrompt(link.phone_e164, selection.courseName, selection.prompt);
      const { error: updateError } = await supabase.from("sds_whatsapp_messages")
        .update({
          status: "sent",
          body: selection.prompt,
          question_id: selection.question.id,
          concept_id: selection.question.concept_id,
          course_id: selection.question.course_id,
          meta_message_id: metaId,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            slot,
            timezone: "America/Lima",
            concept_title: selection.conceptTitle,
            course_name: selection.courseName,
            generation: selection.prompt === selection.question.prompt ? "curated_fallback" : "ai_variant",
          },
        })
        .eq("id", reservation.id);
      if (updateError) throw updateError;
      sent.push(link.user_id);
    } catch {
      await supabase.from("sds_whatsapp_messages")
        .update({ status: "failed", metadata: { reason: "provider_send_failed" } })
        .eq("id", reservation.id);
      skipped.send_error = (skipped.send_error || 0) + 1;
    }
  }

  return Response.json({
    sent: sent.length,
    skipped,
    slot,
    timezone: "America/Lima",
    currentLocalMinutes: nowMinutes,
  });
}
