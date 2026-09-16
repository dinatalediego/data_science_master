import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SUPABASE_URL = "https://tlyczyfsboqrtrdpwizp.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const LEVEL_CONTRACTS: Record<number, string> = {
  1: "Ask one short Socratic question that points to the missing distinction. Do not state the answer.",
  2: "Give one conceptual cue plus one diagnostic question. Do not provide a worked solution.",
  3: "Give a structure, checklist, equation skeleton, or pseudocode scaffold. Leave the key reasoning step to the learner.",
  4: "Show one partial worked step, then stop before the decisive step or final conclusion.",
  5: "Give a concise reference solution and explicitly ask the learner to compare it with their own reasoning.",
};

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "missing_authorization" }, 401);
  }

  let body: {
    missionId?: unknown;
    questionId?: unknown;
    level?: unknown;
    draft?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const missionId =
    typeof body.missionId === "string" ? body.missionId.trim() : "";
  const questionId =
    typeof body.questionId === "string" ? body.questionId.trim() : "";
  const level = Number(body.level);
  const draft = typeof body.draft === "string" ? body.draft.trim().slice(0, 5000) : "";

  if (!missionId || !questionId || !Number.isInteger(level) || level < 1 || level > 5) {
    return json({ error: "invalid_hint_request" }, 422);
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

  const { data: mission, error: missionError } = await supabase
    .from("sds_professor_missions")
    .select("id,user_id,concept_id,status,assistance_ceiling,mission_type,objective")
    .eq("id", missionId)
    .eq("user_id", userData.user.id)
    .single();

  if (missionError || !mission) {
    return json({ error: "mission_not_found" }, 404);
  }

  if (mission.status !== "in_progress") {
    return json({ error: "mission_not_in_progress" }, 409);
  }

  if (level > Number(mission.assistance_ceiling || 0)) {
    return json(
      {
        error: "assistance_ceiling_reached",
        assistanceCeiling: mission.assistance_ceiling,
      },
      403
    );
  }

  const { data: lastAssistance } = await supabase
    .from("sds_professor_assistance_events")
    .select("level")
    .eq("mission_id", missionId)
    .eq("user_id", userData.user.id)
    .gt("level", 0)
    .order("level", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastLevel = Number(lastAssistance?.level || 0);
  if (level > lastLevel + 1) {
    return json({ error: "assistance_levels_must_be_sequential", nextLevel: lastLevel + 1 }, 409);
  }

  const { data: question, error: questionError } = await supabase
    .from("sds_question_bank")
    .select("id,concept_id,prompt,answer_guide,dimension,difficulty")
    .eq("id", questionId)
    .single();

  if (questionError || !question || question.concept_id !== mission.concept_id) {
    return json({ error: "question_not_valid_for_mission" }, 422);
  }

  await supabase.from("sds_professor_assistance_events").insert({
    user_id: userData.user.id,
    mission_id: missionId,
    level,
    event_type: "hint_requested",
    metadata: {
      question_id: questionId,
      mission_type: mission.mission_type,
      draft_present: Boolean(draft),
    },
  });

  const answerGuide =
    typeof question.answer_guide === "string" ? question.answer_guide.trim() : "";

  if (!answerGuide) {
    return json({ error: "question_has_no_reference_criterion" }, 422);
  }

  const system = [
    "You are the SÓCRATES DS Meta-Professor.",
    "Your job is to preserve desirable difficulty and learner agency.",
    "Use the supplied answer guide only as hidden reference material.",
    "Never reveal more help than the requested assistance level allows.",
    "Do not grade the learner here; generate one pedagogically useful hint.",
    "Be concise, precise, and domain-aware.",
    LEVEL_CONTRACTS[level],
  ].join(" ");

  const prompt = [
    `MISSION: ${mission.objective}`,
    `QUESTION: ${question.prompt}`,
    `DIMENSION: ${question.dimension}`,
    `DIFFICULTY: ${question.difficulty}/5`,
    "",
    "HIDDEN REFERENCE CRITERION:",
    answerGuide,
    "",
    "LEARNER DRAFT:",
    draft || "(no draft yet)",
    "",
    `REQUESTED HELP LEVEL: ${level}/5`,
    "Return only the hint text. No markdown heading and no answer-key language.",
  ].join("\n");

  const model = process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol";

  try {
    const result = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: 260,
      temperature: 0.2,
      providerOptions: {
        gateway: {
          disallowPromptTraining: true,
        },
      },
    });

    const hint = result.text.trim().slice(0, 1800);
    if (!hint) throw new Error("empty_hint");

    const { error: logError } = await supabase
      .from("sds_professor_assistance_events")
      .insert({
        user_id: userData.user.id,
        mission_id: missionId,
        level,
        event_type: level >= 4 ? "partial_solution" : level >= 3 ? "structure_shown" : "hint_shown",
        metadata: {
          question_id: questionId,
          provider: "vercel-ai-gateway",
          model,
        },
      });

    if (logError) {
      return json({ error: "hint_generated_but_log_failed" }, 500);
    }

    return json({
      hint,
      level,
      assistanceCeiling: mission.assistance_ceiling,
      nonOfficial: true,
    });
  } catch {
    return json({ error: "hint_generation_unavailable" }, 503);
  }
}
