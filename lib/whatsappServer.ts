import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tlyczyfsboqrtrdpwizp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";

export type WhatsAppClient = SupabaseClient;
export type EvaluatedAnswer = {
  score: number | null;
  evaluatorConfidence: number;
  verdict: "strong" | "partial" | "weak" | "insufficient";
  strengths: string[];
  gaps: string[];
  feedback: string;
  nextPrompt: string;
};

export function createWhatsAppClient(): WhatsAppClient {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("supabase_server_key_missing");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasWhatsAppConfiguration() {
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.META_APP_SECRET &&
    process.env.WHATSAPP_TEMPLATE_NAME &&
    /^v[0-9]+\.[0-9]+$/.test(process.env.WHATSAPP_GRAPH_VERSION || "")
  );
}

export async function authenticatedUserId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(authorization.slice(7));
  return error || !data.user ? null : data.user.id;
}

export function hashPairingCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function newPairingCode() {
  return String(randomInt(100000, 1000000));
}

export function verifyMetaSignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature || !signature.startsWith("sha256=")) return false;
  const supplied = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function graphUrl() {
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  const numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!version || !numberId || !process.env.WHATSAPP_TOKEN) {
    throw new Error("whatsapp_sender_not_configured");
  }
  return "https://graph.facebook.com/" + version + "/" + numberId + "/messages";
}

async function postWhatsApp(payload: Record<string, unknown>) {
  const response = await fetch(graphUrl(), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.WHATSAPP_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error("whatsapp_send_failed:" + (result.error?.message || response.status));
  }
  return result.messages?.[0]?.id || null;
}

function graphRecipient(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function sendWhatsAppText(to: string, body: string) {
  return postWhatsApp({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: graphRecipient(to),
    type: "text",
    text: { preview_url: false, body: body.slice(0, 3900) },
  });
}

export async function sendWhatsAppPrompt(to: string, courseName: string, prompt: string) {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!templateName) throw new Error("whatsapp_template_not_configured");
  return postWhatsApp({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: graphRecipient(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: "estudiante" },
          { type: "text", text: courseName.slice(0, 80) },
          { type: "text", text: prompt.slice(0, 900) },
        ],
      }],
    },
  });
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clamp01(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
        .map((item) => item.trim()).filter(Boolean).slice(0, 5)
    : [];
}

export async function createNovelPrompt(input: {
  courseName: string;
  conceptTitle: string;
  conceptDescription: string;
  referencePrompt: string;
  answerGuide: string;
  recentPrompts: string[];
}) {
  const system = [
    "Eres SÓCRATES DS, tutor personal de una maestría en ciencia de datos.",
    "Escribe una sola píldora breve, sorprendente y aplicada en español.",
    "Conserva el objetivo cognitivo de la pregunta de referencia y su guía; no reveles la respuesta.",
    "Cambia el contexto concreto y evita repetir los últimos casos.",
    "Si el objetivo trata sobre predicción supervisada o leakage, usa un caso nuevo de lead scoring y pide nombrar y y dos predictores X que existan al crear el lead.",
    "No inventes hechos externos ni pidas datos personales. Máximo 420 caracteres; solo la pregunta, sin título ni explicación.",
  ].join(" ");
  const prompt = [
    "CURSO: " + input.courseName,
    "CONCEPTO: " + input.conceptTitle + " — " + input.conceptDescription,
    "PREGUNTA DE REFERENCIA: " + input.referencePrompt,
    "GUÍA DE RESPUESTA: " + input.answerGuide,
    "PREGUNTAS RECIENTES QUE DEBES EVITAR: " + (input.recentPrompts.join(" | ") || "ninguna"),
    "Redacta una variante que evalúe el mismo aprendizaje.",
  ].join("\n");
  const result = await generateText({
    model: process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol",
    system,
    prompt,
    temperature: 0.85,
    maxOutputTokens: 220,
    providerOptions: { gateway: { disallowPromptTraining: true } },
  });
  const candidate = result.text.trim().replace(/^["“]|["”]$/g, "").slice(0, 420);
  if (candidate.length < 35) throw new Error("generated_prompt_invalid");
  return candidate;
}

export async function evaluateWhatsAppAnswer(input: {
  courseName: string;
  conceptTitle: string;
  referencePrompt: string;
  answerGuide: string;
  promptSent: string;
  answer: string;
}): Promise<EvaluatedAnswer> {
  const system = [
    "Eres SÓCRATES DS Evidence Evaluator.",
    "Evalúa solo frente a la pregunta y la guía explícita. No inventes criterios.",
    "Es feedback formativo, no una calificación oficial.",
    "Distingue corrección de confianza del evaluador. Si la respuesta no permite un juicio fiable usa verdict insufficient y score null.",
    "Cuando la pregunta pida y y X, comprueba que y sea un outcome futuro con horizonte y que ambas X estuvieran disponibles en t0; una variable posterior es leakage.",
    "Devuelve JSON estricto sin Markdown con score, evaluatorConfidence, verdict, strengths, gaps, feedback y nextPrompt.",
    "score y evaluatorConfidence van de 0 a 1. verdict es strong, partial, weak o insufficient.",
  ].join(" ");
  const prompt = [
    "CURSO: " + input.courseName,
    "CONCEPTO: " + input.conceptTitle,
    "PREGUNTA CANÓNICA: " + input.referencePrompt,
    "GUÍA DE RESPUESTA: " + input.answerGuide,
    "PREGUNTA QUE RECIBIÓ EL ESTUDIANTE: " + input.promptSent,
    "RESPUESTA DEL ESTUDIANTE: " + input.answer,
    "Evalúa cobertura y razonamiento contra la guía; premia alternativas válidas y señala cualquier fuga temporal.",
    "CRITERIO COMPARTIDO SI LA PREGUNTA LO PIDE: y es un outcome observable futuro con horizonte definido; las dos X existen al crear el lead y no contienen información posterior al instante de predicción.",
  ].join("\n");
  const result = await generateText({
    model: process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol",
    system,
    prompt,
    temperature: 0.15,
    maxOutputTokens: 650,
    providerOptions: { gateway: { disallowPromptTraining: true } },
  });
  const raw = parseJsonObject(result.text);
  if (!raw) throw new Error("evaluation_payload_invalid");
  const allowed = new Set(["strong", "partial", "weak", "insufficient"]);
  const verdict =
    typeof raw.verdict === "string" && allowed.has(raw.verdict)
      ? raw.verdict as EvaluatedAnswer["verdict"]
      : null;
  const feedback = boundedText(raw.feedback, 1800);
  if (!verdict || !feedback) throw new Error("evaluation_payload_invalid");
  return {
    score: verdict === "insufficient" || raw.score === null || raw.score === undefined
      ? null
      : clamp01(raw.score),
    evaluatorConfidence: clamp01(raw.evaluatorConfidence),
    verdict,
    strengths: stringList(raw.strengths),
    gaps: stringList(raw.gaps),
    feedback,
    nextPrompt: boundedText(raw.nextPrompt, 450),
  };
}

export function buildWhatsAppFeedback(evaluation: EvaluatedAnswer) {
  const labels: Record<EvaluatedAnswer["verdict"], string> = {
    strong: "sólida",
    partial: "parcial",
    weak: "a reforzar",
    insufficient: "necesita más evidencia",
  };
  const score = evaluation.score === null
    ? ""
    : " Evidencia estimada: " + Math.round(evaluation.score * 100) + "%.";
  const strengths = evaluation.strengths.length
    ? "\nLo que hiciste bien: " + evaluation.strengths.join("; ") + "."
    : "";
  const gaps = evaluation.gaps.length
    ? "\nPara afinar: " + evaluation.gaps.join("; ") + "."
    : "";
  const next = evaluation.nextPrompt ? "\nSiguiente paso: " + evaluation.nextPrompt : "";
  return (
    "Contraste formativo: respuesta " + labels[evaluation.verdict] + "." + score +
    "\n" + evaluation.feedback + strengths + gaps + next +
    "\n\nNo es una nota oficial. — SÓCRATES DS"
  ).slice(0, 3500);
}

export function limaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

export function limaWeekday(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima", weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return map[weekday] || 0;
}

export function localTimeMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}
