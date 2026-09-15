import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SUPABASE_URL = "https://tlyczyfsboqrtrdpwizp.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";

const MODES = new Set([
  "explain",
  "socratic",
  "quiz",
  "derive",
  "apply",
  "summary",
  "concept_cards",
  "infographic",
  "checklist",
]);

type Mode =
  | "explain"
  | "socratic"
  | "quiz"
  | "derive"
  | "apply"
  | "summary"
  | "concept_cards"
  | "infographic"
  | "checklist";

type Chunk = {
  chunk_id: string;
  source_id: string;
  heading: string | null;
  locator: string;
  content_note: string;
  rank: number;
};

type Artifact = {
  artifact_type: string;
  title: string;
  content: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function modeInstruction(mode: Mode) {
  const instructions: Record<Mode, string> = {
    explain:
      "Explain the idea clearly in Spanish, from intuition to formal meaning. Use a small example only if the evidence supports it.",
    socratic:
      "Do not lecture. Ask one high-quality Socratic question at a time, then add a short hint that does not reveal the full answer.",
    quiz:
      "Create a short closed-book quiz with 3 questions ordered from recall to transfer. Do not provide answers unless explicitly requested.",
    derive:
      "Walk through the derivation step by step. State each assumption and stop if the retrieved evidence is insufficient for a step.",
    apply:
      "Connect the source idea to one realistic data-science or business problem. Clearly separate the source-grounded idea from the new application.",
    summary:
      "Create a compact one-page-style brief: central thesis, 4-6 key ideas, common confusion, and 3 self-test questions.",
    concept_cards:
      "Create 5-8 concept cards. Each card must have: term, intuition, formal relation, and one misconception to avoid.",
    infographic:
      "Create a text infographic specification: nodes, arrows/relationships, hierarchy, and a short visual narrative. Do not pretend an image was generated.",
    checklist:
      "Create an active-study checklist that requires observable evidence, not passive reading. Include preview, explain-without-looking, derivation/problem, and transfer.",
  };
  return instructions[mode];
}

function fallbackResponse(
  mode: Mode,
  unitTitle: string,
  chunks: Chunk[],
  artifacts: Artifact[],
  question: string
) {
  const evidence = chunks.length
    ? chunks
        .slice(0, 5)
        .map(
          (chunk, index) =>
            `${index + 1}. ${chunk.heading || "Idea"} — ${chunk.content_note} [${chunk.locator}]`
        )
        .join("\n")
    : artifacts
        .slice(0, 4)
        .map((artifact, index) => {
          const compact = JSON.stringify(artifact.content);
          return `${index + 1}. ${artifact.title}: ${compact.slice(0, 420)}`;
        })
        .join("\n");

  if (!evidence) {
    return `No tengo evidencia recuperada suficiente para responder de forma source-grounded sobre “${unitTitle}”. No voy a completar el vacío con conocimiento general. Abre la fuente o carga material adicional y vuelve a intentar.`;
  }

  if (mode === "quiz" || mode === "socratic") {
    const base = chunks.slice(0, 3);
    return [
      `Modo ${mode === "quiz" ? "Examiner" : "Socrático"} · ${unitTitle}`,
      "",
      ...base.map((chunk, index) => {
        const stem =
          index === 0
            ? "Explícalo sin mirar: ¿cuál es la idea central y qué supuesto la hace válida?"
            : index === 1
              ? "Contrasta este concepto con una alternativa cercana: ¿qué pregunta responde cada uno?"
              : "Transfiere la idea: ¿qué cambiaría en una aplicación real si este supuesto fallara?";
        return `${index + 1}. ${stem}\n   Fuente: ${chunk.locator}`;
      }),
      "",
      "Responde primero. Después contrasta tu respuesta con la fuente.",
    ].join("\n");
  }

  return [
    `SÓCRATES · ${unitTitle}`,
    question ? `Pregunta: ${question}` : "",
    "",
    "Evidencia recuperada:",
    evidence,
    "",
    "La generación IA no estuvo disponible en esta ejecución. Te muestro únicamente evidencia source-grounded y no completo los huecos con contenido no recuperado.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "missing_authorization" }, 401);
  }

  let body: {
    readingUnitId?: unknown;
    mode?: unknown;
    message?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const readingUnitId =
    typeof body.readingUnitId === "string" ? body.readingUnitId.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  if (!readingUnitId || !MODES.has(mode)) {
    return json({ error: "invalid_request" }, 422);
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ error: "invalid_session" }, 401);
  }

  const [
    unitResult,
    chunkResult,
    artifactResult,
  ] = await Promise.all([
    supabase
      .from("sds_reading_units")
      .select(
        "id,title,objective,why_it_matters,source_locator,grounding_status,source_id,external_resource_id"
      )
      .eq("id", readingUnitId)
      .single(),
    supabase.rpc("sds_search_reading_chunks", {
      p_reading_unit_id: readingUnitId,
      p_query: message || mode,
      p_limit: 6,
    }),
    supabase
      .from("sds_reading_artifacts")
      .select("artifact_type,title,content")
      .eq("reading_unit_id", readingUnitId)
      .eq("active", true)
      .limit(8),
  ]);

  if (unitResult.error || !unitResult.data) {
    return json({ error: "reading_unit_not_found" }, 404);
  }

  const unit = unitResult.data;
  const chunks = ((chunkResult.data || []) as Chunk[]).slice(0, 6);
  const artifacts = ((artifactResult.data || []) as Artifact[]).slice(0, 8);

  const locators = chunks.map((chunk) => chunk.locator);
  const chunkIds = chunks.map((chunk) => chunk.chunk_id);

  const sourceEvidence = chunks
    .map(
      (chunk, index) =>
        `[S${index + 1}] ${chunk.heading || "Source note"}\nLocator: ${chunk.locator}\nEvidence: ${chunk.content_note}`
    )
    .join("\n\n");

  const artifactEvidence = artifacts
    .map(
      (artifact, index) =>
        `[A${index + 1}] ${artifact.title}\nType: ${artifact.artifact_type}\nContent: ${JSON.stringify(artifact.content)}`
    )
    .join("\n\n");

  const groundingStatus = chunks.length
    ? "grounded"
    : artifacts.length
      ? "partial"
      : "insufficient";

  const system = [
    "You are SÓCRATES DS, a rigorous source-grounded learning companion.",
    "Respond in Spanish unless the learner explicitly asks for another language.",
    "Use ONLY the evidence supplied in the prompt for source-specific factual claims.",
    "If the evidence does not support a requested claim, say so explicitly.",
    "Do not quote long passages. Prefer paraphrase and preserve the source terminology.",
    "Every substantive source-derived claim should end with a locator such as [S1].",
    "Separate source-grounded explanation from your own transfer/application suggestions.",
    "Never equate reading completion with mastery.",
    modeInstruction(mode as Mode),
  ].join(" ");

  const userPrompt = [
    `READING UNIT: ${unit.title}`,
    `OBJECTIVE: ${unit.objective}`,
    `WHY IT MATTERS: ${unit.why_it_matters}`,
    `SOURCE LOCATOR: ${unit.source_locator || "Not specified"}`,
    "",
    message ? `LEARNER REQUEST: ${message}` : "LEARNER REQUEST: Generate the selected study aid.",
    "",
    "SOURCE EVIDENCE:",
    sourceEvidence || "(No retrieved source chunks.)",
    "",
    "CURATED UNIT ARTIFACTS:",
    artifactEvidence || "(No curated artifacts.)",
  ].join("\n");

  let responseText = "";
  let provider = "fallback";
  let model: string | null = null;

  if (groundingStatus !== "insufficient") {
    try {
      model = process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol";

      const result = await generateText({
        model,
        system,
        prompt: userPrompt,
        maxOutputTokens: mode === "summary" || mode === "concept_cards" ? 1100 : 850,
        temperature: 0.25,
        providerOptions: {
          gateway: {
            disallowPromptTraining: true,
          },
        },
      });

      responseText = result.text.trim();
      if (responseText) {
        provider = "vercel-ai-gateway";
      }
    } catch {
      responseText = fallbackResponse(
        mode as Mode,
        unit.title,
        chunks,
        artifacts,
        message
      );
      model = null;
    }
  } else {
    responseText = fallbackResponse(
      mode as Mode,
      unit.title,
      chunks,
      artifacts,
      message
    );
  }

  const latencyMs = Date.now() - startedAt;

  const { error: logError } = await supabase.from("sds_ai_interactions").insert({
    user_id: userData.user.id,
    reading_unit_id: readingUnitId,
    mode,
    prompt: message || `generate:${mode}`,
    response_text: responseText,
    source_chunk_ids: chunkIds,
    source_locators: locators,
    provider,
    model,
    grounding_status: groundingStatus,
    latency_ms: latencyMs,
  });

  return json({
    text: responseText,
    citations: locators,
    provider,
    model,
    groundingStatus,
    latencyMs,
    logged: !logError,
  });
}
