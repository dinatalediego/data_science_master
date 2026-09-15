import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const FALLBACK_SUPABASE_URL = "https://tlyczyfsboqrtrdpwizp.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";

type Chunk = {
  chunk_id: string;
  heading: string | null;
  locator: string;
  content_note: string;
};

type PackContent = {
  orientation_letter: string;
  summary: {
    thesis: string;
    key_ideas: string[];
    misconception: string;
    self_test: string[];
  };
  concept_cards: Array<{
    term: string;
    intuition: string;
    formal_relation: string;
    misconception: string;
    locator: string;
  }>;
  infographic: {
    title: string;
    nodes: Array<{ id: string; label: string; note: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
    narrative: string;
  };
  practice: {
    recall: string[];
    derive: string[];
    apply: string[];
  };
  checklist: string[];
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function fallbackPack(unitTitle: string, chunks: Chunk[]): PackContent {
  const ideas = chunks.slice(0, 6);
  const locators = ideas.map((chunk) => chunk.locator);

  return {
    orientation_letter:
      `Esta misión gira alrededor de “${unitTitle}”. Antes de memorizar, identifica qué problema resuelve cada idea y qué supuesto la sostiene. Trabaja con la fuente abierta solo para verificar; la evidencia real aparece cuando puedas reconstruirla con el documento cerrado.`,
    summary: {
      thesis:
        ideas[0]?.content_note ||
        "No hay evidencia suficiente recuperada para producir un resumen confiable.",
      key_ideas: ideas.map(
        (chunk) => `${chunk.content_note} [${chunk.locator}]`
      ),
      misconception:
        "No confundas haber reconocido la explicación al leerla con poder recuperarla y aplicarla sin apoyo.",
      self_test: [
        "¿Cuál es la idea central y qué supuesto la hace válida?",
        "¿Qué concepto cercano podría confundirse con éste y cómo los distinguirías?",
        "¿Qué cambiaría en una aplicación real si el supuesto principal fallara?",
      ],
    },
    concept_cards: ideas.slice(0, 5).map((chunk, index) => ({
      term: chunk.heading || `Concepto ${index + 1}`,
      intuition: chunk.content_note,
      formal_relation:
        "Reconstruye la relación formal directamente desde la fuente antes de marcarla como dominada.",
      misconception:
        "Reconocer una definición no demuestra que puedas usarla fuera del ejemplo original.",
      locator: chunk.locator,
    })),
    infographic: {
      title: `Mapa conceptual — ${unitTitle}`,
      nodes: ideas.slice(0, 6).map((chunk, index) => ({
        id: `n${index + 1}`,
        label: chunk.heading || `Idea ${index + 1}`,
        note: chunk.locator,
      })),
      edges: ideas.slice(1, 6).map((chunk, index) => ({
        from: `n${index + 1}`,
        to: `n${index + 2}`,
        label: "conecta con",
      })),
      narrative:
        "Recorre el mapa preguntando por qué cada nodo necesita al anterior. Verifica la relación contra las páginas indicadas.",
    },
    practice: {
      recall: [
        "Explica la tesis central sin mirar la fuente.",
        "Define dos conceptos importantes y contrástalos.",
      ],
      derive: [
        "Reconstruye una relación, derivación o argumento central y anota dónde necesitas volver a consultar.",
      ],
      apply: [
        "Transfiere una idea de la lectura a un problema real de data science o de tu trabajo y explicita qué supuesto podría romperse.",
      ],
    },
    checklist: [
      "Formulé 3 preguntas antes de releer.",
      "Puedo explicar la tesis central sin mirar.",
      "Puedo reconstruir una relación formal o argumento.",
      "Resolví o diseñé una aplicación nueva.",
      "Verifiqué mis huecos contra la fuente.",
      `Puedo ubicar la evidencia en: ${locators.join(", ") || "fuente pendiente"}.`,
    ],
  };
}

function parsePack(text: string): PackContent | null {
  const cleaned = text
    .trim()
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/\`\`\`$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed?.orientation_letter === "string" &&
      parsed?.summary &&
      Array.isArray(parsed?.concept_cards) &&
      parsed?.infographic &&
      parsed?.practice &&
      Array.isArray(parsed?.checklist)
    ) {
      return parsed as PackContent;
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "missing_authorization" }, 401);
  }

  let body: { readingUnitId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const readingUnitId =
    typeof body.readingUnitId === "string" ? body.readingUnitId.trim() : "";
  if (!readingUnitId) return json({ error: "missing_reading_unit" }, 422);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    }
  );

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json({ error: "invalid_session" }, 401);

  const [unitResult, chunksResult] = await Promise.all([
    supabase
      .from("sds_reading_units")
      .select("id,title,objective,why_it_matters,source_locator")
      .eq("id", readingUnitId)
      .single(),
    supabase.rpc("sds_search_reading_chunks", {
      p_reading_unit_id: readingUnitId,
      p_query: "central ideas definitions derivation relationship practice application",
      p_limit: 10,
    }),
  ]);

  if (unitResult.error || !unitResult.data) {
    return json({ error: "reading_unit_not_found" }, 404);
  }

  const chunks = ((chunksResult.data || []) as Chunk[]).slice(0, 10);
  if (!chunks.length) {
    return json({ error: "insufficient_source_evidence" }, 422);
  }

  const evidence = chunks
    .map(
      (chunk, index) =>
        `[S${index + 1}] ${chunk.heading || "Idea"}\nLocator: ${chunk.locator}\nEvidence: ${chunk.content_note}`
    )
    .join("\n\n");

  const fallback = fallbackPack(unitResult.data.title, chunks);
  let content: PackContent = fallback;
  let provider = "fallback";
  let model: string | null = null;

  try {
    model = process.env.SOCRATES_AI_MODEL || "openai/gpt-5.6-sol";
    const result = await generateText({
      model,
      system: [
        "You are SÓCRATES DS, a rigorous source-grounded learning designer.",
        "Return ONLY valid JSON. No markdown fences.",
        "Use only the supplied evidence for source-specific claims.",
        "Write in Spanish.",
        "Do not reproduce long passages; paraphrase.",
        "Preserve evidence locators such as [S1] in factual sections.",
        "Reading is not mastery: tasks must demand recall, derivation, application or transfer.",
      ].join(" "),
      prompt: `Create a persistent study pack for this reading.

UNIT: ${unitResult.data.title}
OBJECTIVE: ${unitResult.data.objective}
WHY IT MATTERS: ${unitResult.data.why_it_matters}

EVIDENCE:
${evidence}

Return exactly this JSON shape:
{
  "orientation_letter": "string",
  "summary": {
    "thesis": "string",
    "key_ideas": ["string"],
    "misconception": "string",
    "self_test": ["string"]
  },
  "concept_cards": [
    {
      "term": "string",
      "intuition": "string",
      "formal_relation": "string",
      "misconception": "string",
      "locator": "source locator"
    }
  ],
  "infographic": {
    "title": "string",
    "nodes": [{"id":"n1","label":"string","note":"string"}],
    "edges": [{"from":"n1","to":"n2","label":"string"}],
    "narrative": "string"
  },
  "practice": {
    "recall": ["string"],
    "derive": ["string"],
    "apply": ["string"]
  },
  "checklist": ["string"]
}

Keep it concise but educational. Include 4-7 concept cards, 4-7 infographic nodes, and at least 2 items in each practice group.`,
      maxOutputTokens: 2400,
      temperature: 0.2,
      providerOptions: {
        gateway: { disallowPromptTraining: true },
      },
    });

    const parsed = parsePack(result.text);
    if (parsed) {
      content = parsed;
      provider = "vercel-ai-gateway";
    } else {
      model = null;
    }
  } catch {
    model = null;
  }

  const { data: latest } = await supabase
    .from("sds_user_study_packs")
    .select("version")
    .eq("user_id", user.id)
    .eq("reading_unit_id", readingUnitId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version || 0) + 1;
  const sourceLocators = [...new Set(chunks.map((chunk) => chunk.locator))];
  const sourceChunkIds = chunks.map((chunk) => chunk.chunk_id);
  const generationMs = Date.now() - startedAt;

  const { data: pack, error: insertError } = await supabase
    .from("sds_user_study_packs")
    .insert({
      user_id: user.id,
      reading_unit_id: readingUnitId,
      version,
      content,
      source_chunk_ids: sourceChunkIds,
      source_locators: sourceLocators,
      provider,
      model,
      grounding_status: "grounded",
      generation_ms: generationMs,
    })
    .select("*")
    .single();

  if (insertError || !pack) {
    return json({ error: insertError?.message || "study_pack_save_failed" }, 500);
  }

  return json({
    pack,
    generatedWithAI: provider === "vercel-ai-gateway",
  });
}
