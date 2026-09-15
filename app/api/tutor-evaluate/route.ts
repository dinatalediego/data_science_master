import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SUPABASE_URL = "https://tlyczyfsboqrtrdpwizp.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";

type EvaluationPayload = {
  score: number;
  evaluatorConfidence: number;
  verdict: "strong" | "partial" | "weak" | "insufficient";
  strengths: string[];
  gaps: string[];
  feedback: string;
  nextPrompt: string;
  rubric: {
    criteria?: Array<{
      name: string;
      assessment: string;
    }>;
  };
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clamp01(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function cleanStringArray(value: unknown, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "");

  try {
    const parsed = JSON.parse(withoutFence);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(withoutFence.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function normalizeEvaluation(raw: Record<string, unknown>): EvaluationPayload | null {
  const score = clamp01(raw.score);
  const evaluatorConfidence = clamp01(raw.evaluatorConfidence);
  const allowedVerdicts = new Set(["strong", "partial", "weak", "insufficient"]);
  const verdict =
    typeof raw.verdict === "string" && allowedVerdicts.has(raw.verdict)
      ? (raw.verdict as EvaluationPayload["verdict"])
      : null;

  const feedback =
    typeof raw.feedback === "string" ? raw.feedback.trim().slice(0, 3000) : "";
  const nextPrompt =
    typeof raw.nextPrompt === "string" ? raw.nextPrompt.trim().slice(0, 1800) : "";

  if (!verdict || !feedback) return null;

  const rubric =
    raw.rubric && typeof raw.rubric === "object" && !Array.isArray(raw.rubric)
      ? (raw.rubric as EvaluationPayload["rubric"])
      : {};

  return {
    score,
    evaluatorConfidence,
    verdict,
    strengths: cleanStringArray(raw.strengths),
    gaps: cleanStringArray(raw.gaps),
    feedback,
    nextPrompt,
    rubric,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "missing_authorization" }, 401);
  }

  let body: { attemptId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const attemptId =
    typeof body.attemptId === "string" ? body.attemptId.trim() : "";

  if (!attemptId) {
    return json({ error: "attempt_id_required" }, 422);
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
      headers: { Authorization: authorization },
    },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ error: "invalid_session" }, 401);
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("sds_attempts")
    .select(
      "id,user_id,question_id,concept_id,response_text,self_score,confidence,created_at"
    )
    .eq("id", attemptId)
    .eq("user_id", userData.user.id)
    .single();

  if (attemptError || !attempt) {
    return json({ error: "attempt_not_found" }, 404);
  }

  if (!attempt.question_id) {
    return json({ error: "attempt_has_no_question" }, 422);
  }

  const { data: question, error: questionError } = await supabase
    .from("sds_question_bank")
    .select("id,prompt,answer_guide,dimension,difficulty,course_id,concept_id")
    .eq("id", attempt.question_id)
    .single();

  if (questionError || !question) {
    return json({ error: "question_not_found" }, 404);
  }

  const { data: latestVersionRow } = await supabase
    .from("sds_attempt_evaluations")
    .select("evaluation_version")
    .eq("attempt_id", attemptId)
    .eq("user_id", userData.user.id)
    .order("evaluation_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const evaluationVersion =
    Number(latestVersionRow?.evaluation_version || 0) + 1;

  const answerGuide =
    typeof question.answer_guide === "string" ? question.answer_guide.trim() : "";

  if (!answerGuide) {
    const latencyMs = Date.now() - startedAt;
    const { data: row, error: insertError } = await supabase
      .from("sds_attempt_evaluations")
      .insert({
        user_id: userData.user.id,
        attempt_id: attemptId,
        evaluation_version: evaluationVersion,
        status: "insufficient",
        evaluator_type: "ai",
        score: null,
        evaluator_confidence: 0,
        verdict: "insufficient",
        strengths: [],
        gaps: [],
        feedback:
          "No hay una guía de contraste explícita para esta pregunta. SÓCRATES no asignará un score independiente sin criterio de referencia.",
        next_prompt:
          "Conserva tu autoevaluación como señal provisional y solicita una pregunta con guía explícita.",
        rubric: {
          reference: "missing_answer_guide",
          non_official: true,
        },
        provider: "none",
        model: null,
        latency_ms: latencyMs,
      })
      .select("*")
      .single();

    if (insertError) {
      return json({ error: "evaluation_insert_failed" }, 500);
    }

    return json({
      evaluation: row,
      effectiveScoreSource: "self_score",
      nonOfficial: true,
    });
  }

  const system = [
    "You are SÓCRATES DS Evidence Evaluator.",
    "Evaluate a learner response ONLY against the supplied question and answer guide.",
    "Do not add grading criteria that are not supported by the guide.",
    "This is formative, non-official feedback, not an academic grade.",
    "Separate correctness/coverage from confidence.",
    "Return strict JSON only, with no markdown fences.",
    "Required keys: score, evaluatorConfidence, verdict, strengths, gaps, feedback, nextPrompt, rubric.",
    "score and evaluatorConfidence must be numbers from 0 to 1.",
    "verdict must be strong, partial, weak, or insufficient.",
    "strengths and gaps must be short arrays of strings.",
    "If the answer guide is too vague to support a reliable judgment, lower evaluatorConfidence and use verdict insufficient.",
  ].join(" ");

  const prompt = [
    `QUESTION:\n${question.prompt}`,
    `DIMENSION: ${question.dimension}`,
    `DIFFICULTY: ${question.difficulty}/5`,
    "",
    "ANSWER GUIDE / REFERENCE CRITERION:",
    answerGuide,
    "",
    "LEARNER RESPONSE:",
    attempt.response_text || "(empty)",
    "",
    `LEARNER SELF-SCORE: ${attempt.self_score ?? "not provided"}`,
    `LEARNER CONFIDENCE: ${attempt.confidence ?? "not provided"}`,
    "",
    "Evaluate the learner response against the answer guide. Do not simply mirror the learner self-score.",
  ].join("\n");

  const model = process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol";

  try {
    const result = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: 900,
      temperature: 0.15,
      providerOptions: {
        gateway: {
          disallowPromptTraining: true,
        },
      },
    });

    const parsed = parseJsonObject(result.text);
    const evaluation = parsed ? normalizeEvaluation(parsed) : null;

    if (!evaluation) {
      throw new Error("invalid_evaluator_payload");
    }

    const latencyMs = Date.now() - startedAt;
    const { data: row, error: insertError } = await supabase
      .from("sds_attempt_evaluations")
      .insert({
        user_id: userData.user.id,
        attempt_id: attemptId,
        evaluation_version: evaluationVersion,
        status:
          evaluation.verdict === "insufficient" ? "insufficient" : "completed",
        evaluator_type: "ai",
        score: evaluation.score,
        evaluator_confidence: evaluation.evaluatorConfidence,
        verdict: evaluation.verdict,
        strengths: evaluation.strengths,
        gaps: evaluation.gaps,
        feedback: evaluation.feedback,
        next_prompt: evaluation.nextPrompt,
        rubric: {
          ...evaluation.rubric,
          question_dimension: question.dimension,
          question_difficulty: question.difficulty,
          reference: "question_answer_guide",
          non_official: true,
        },
        provider: "vercel-ai-gateway",
        model,
        latency_ms: latencyMs,
      })
      .select("*")
      .single();

    if (insertError) {
      return json({ error: "evaluation_insert_failed" }, 500);
    }

    const trusted =
      row.status === "completed" &&
      row.score !== null &&
      Number(row.evaluator_confidence || 0) >= 0.65;

    return json({
      evaluation: row,
      effectiveScore: trusted ? row.score : attempt.self_score,
      effectiveScoreSource: trusted ? "evaluator" : "self_score",
      nonOfficial: true,
    });
  } catch {
    const latencyMs = Date.now() - startedAt;
    const { data: row, error: insertError } = await supabase
      .from("sds_attempt_evaluations")
      .insert({
        user_id: userData.user.id,
        attempt_id: attemptId,
        evaluation_version: evaluationVersion,
        status: "unavailable",
        evaluator_type: "ai",
        score: null,
        evaluator_confidence: 0,
        verdict: "insufficient",
        strengths: [],
        gaps: [],
        feedback:
          "La evaluación independiente no estuvo disponible. Tu respuesta se conservó intacta y la autoevaluación sigue siendo la señal provisional.",
        next_prompt:
          "Continúa con la guía de contraste y vuelve a evaluar este concepto en una sesión posterior.",
        rubric: {
          reference: "evaluation_unavailable",
          non_official: true,
        },
        provider: "unavailable",
        model,
        latency_ms: latencyMs,
      })
      .select("*")
      .single();

    if (insertError) {
      return json({ error: "evaluation_unavailable_and_log_failed" }, 503);
    }

    return json({
      evaluation: row,
      effectiveScore: attempt.self_score,
      effectiveScoreSource: "self_score",
      nonOfficial: true,
    });
  }
}
