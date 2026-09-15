import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { PDFParse } from "pdf-parse";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const FALLBACK_SUPABASE_URL = "https://tlyczyfsboqrtrdpwizp.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";
const BUCKET = "sds-readings";
const MAX_BYTES = 25 * 1024 * 1024;

type ChunkInsert = {
  source_id: string;
  reading_unit_id: string;
  sequence: number;
  heading: string;
  locator: string;
  content_note: string;
  keywords: string[];
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function chunkPage(text: string, maxChars = 1800, overlap = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    if (end < normalized.length) {
      const candidates = [
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("; ", end),
        normalized.lastIndexOf(" ", end),
      ].filter((value) => value > start + Math.floor(maxChars * 0.55));

      if (candidates.length) end = Math.max(...candidates) + 1;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function keywordsFrom(text: string) {
  const stop = new Set([
    "para","como","esta","este","estos","estas","that","with","from","this","have",
    "will","into","sobre","entre","desde","when","where","their","there","which",
    "your","using","used","also","data","page","chapter"
  ]);

  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9][a-z0-9_-]{3,}/g) || [];

  const counts = new Map<string, number>();
  for (const word of words) {
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

async function insertInBatches(
  supabase: SupabaseClient,
  rows: ChunkInsert[]
) {
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const { error } = await supabase.from("sds_source_chunks").insert(batch);
    if (error) throw error;
  }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "missing_authorization" }, 401);
  }

  let body: {
    storagePath?: unknown;
    courseId?: unknown;
    title?: unknown;
    originalFilename?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const storagePath =
    typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const title = safeTitle(typeof body.title === "string" ? body.title : "");
  const originalFilename = safeTitle(
    typeof body.originalFilename === "string" ? body.originalFilename : "reading.pdf"
  );

  if (!storagePath || !courseId || !title) {
    return json({ error: "missing_fields" }, 422);
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;

  if (userError || !user) return json({ error: "invalid_session" }, 401);
  if (!storagePath.startsWith(`${user.id}/`)) {
    return json({ error: "storage_path_not_owned" }, 403);
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("sds_enrollments")
    .select("course_id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return json({ error: "course_not_enrolled" }, 403);
  }

  const { data: ingestion, error: ingestionError } = await supabase
    .from("sds_source_ingestions")
    .upsert(
      {
        user_id: user.id,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        status: "processing",
        started_at: new Date().toISOString(),
        error_message: null,
      },
      { onConflict: "user_id,storage_path" }
    )
    .select("id")
    .single();

  if (ingestionError || !ingestion) {
    return json({ error: ingestionError?.message || "ingestion_init_failed" }, 500);
  }

  let sourceId: string | null = null;
  let unitId: string | null = null;

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message || "pdf_download_failed");
    }

    if (fileBlob.size > MAX_BYTES) {
      throw new Error("El PDF supera el límite de 25 MB.");
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sourceHash = createHash("sha256").update(buffer).digest("hex");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();

    const pages = parsed.pages.map((page) => page.text.trim());
    const pageCount = parsed.total;

    if (!pageCount || pages.every((page) => !page.trim())) {
      throw new Error(
        "No pude extraer texto del PDF. Si es un escaneo, necesitará OCR en una versión posterior."
      );
    }

    const slug = `private-${user.id.slice(0, 8)}-${randomUUID()}`;
    const { data: source, error: sourceError } = await supabase
      .from("sds_reading_sources")
      .insert({
        slug,
        title,
        author: null,
        institution_or_publisher: "Private upload",
        publication_year: null,
        source_kind: "uploaded_book",
        external_url: null,
        access_note: "Private user-owned upload. Visible only to its owner.",
        citation_note: originalFilename,
        owner_user_id: user.id,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        mime_type: fileBlob.type || "application/pdf",
        file_size_bytes: fileBlob.size,
        page_count: pageCount,
        processing_status: "processing",
        processing_error: null,
        source_hash: sourceHash,
      })
      .select("id")
      .single();

    if (sourceError || !source) {
      throw new Error(sourceError?.message || "source_insert_failed");
    }
    sourceId = source.id;

    const { count: privateUnitCount } = await supabase
      .from("sds_reading_units")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("owner_user_id", user.id);

    const estimatedMinutes = Math.max(
      20,
      Math.min(240, Math.ceil(pageCount * 3.5))
    );

    const { data: unit, error: unitError } = await supabase
      .from("sds_reading_units")
      .insert({
        slug: `${slug}-route`,
        course_id: courseId,
        source_id: sourceId,
        external_resource_id: null,
        owner_user_id: user.id,
        week_label: "Private Reading",
        sequence: 100 + (privateUnitCount || 0),
        title,
        source_locator: `Private PDF · ${pageCount} pages`,
        objective:
          "Comprender, explicar sin mirar y aplicar las ideas centrales de esta lectura privada.",
        why_it_matters:
          "Esta misión convierte el documento en evidencia activa de aprendizaje y mantiene trazabilidad hasta sus páginas.",
        estimated_minutes: estimatedMinutes,
        difficulty: 3,
        grounding_status: "source_grounded",
        active: true,
      })
      .select("id")
      .single();

    if (unitError || !unit) {
      throw new Error(unitError?.message || "reading_unit_insert_failed");
    }
    unitId = unit.id;

    const rows: ChunkInsert[] = [];
    let sequence = 1;

    pages.forEach((pageText, pageIndex) => {
      const pageChunks = chunkPage(pageText);
      pageChunks.forEach((contentNote, chunkIndex) => {
        rows.push({
          source_id: sourceId!,
          reading_unit_id: unitId!,
          sequence,
          heading:
            pageChunks.length > 1
              ? `Página ${pageIndex + 1} · fragmento ${chunkIndex + 1}`
              : `Página ${pageIndex + 1}`,
          locator: `p. ${pageIndex + 1}`,
          content_note: contentNote,
          keywords: keywordsFrom(contentNote),
        });
        sequence += 1;
      });
    });

    if (!rows.length) throw new Error("No se generaron fragmentos recuperables.");

    await insertInBatches(supabase, rows);

    const taskRows = [
      {
        task_key: "preview",
        sequence: 1,
        task_type: "preview",
        title: "Preview inteligente",
        instructions:
          "Antes de leer, escribe 3 preguntas que esperas poder responder al terminar.",
        evidence_expected: "3 preguntas propias",
        estimated_minutes: 8,
        priority: 3,
      },
      {
        task_key: "read",
        sequence: 2,
        task_type: "read",
        title: "Lectura activa",
        instructions:
          "Lee el tramo que decidas trabajar. Marca definiciones, supuestos y un punto que todavía no puedas reconstruir.",
        evidence_expected: "Definiciones + supuesto + punto difícil",
        estimated_minutes: Math.max(20, Math.min(60, estimatedMinutes - 40)),
        priority: 5,
      },
      {
        task_key: "explain",
        sequence: 3,
        task_type: "explain",
        title: "Explícalo sin mirar",
        instructions:
          "Cierra el PDF y reconstruye la idea central. Registra exactamente dónde apareció el primer hueco.",
        evidence_expected: "Explicación propia + hueco identificado",
        estimated_minutes: 12,
        priority: 5,
      },
      {
        task_key: "practice",
        sequence: 4,
        task_type: "solve",
        title: "Prueba de transferencia",
        instructions:
          "Resuelve, deriva o aplica una idea del documento. No marques completado solo por haber leído.",
        evidence_expected: "Respuesta, derivación o mini-aplicación",
        estimated_minutes: 20,
        priority: 5,
      },
    ].map((task) => ({ ...task, reading_unit_id: unitId }));

    const { error: taskError } = await supabase
      .from("sds_reading_task_templates")
      .insert(taskRows);
    if (taskError) throw taskError;

    const sample = rows
      .slice(0, Math.min(rows.length, 120))
      .map((row) => row.content_note)
      .join(" ")
      .toLowerCase();

    const { data: courseConceptLinks } = await supabase
      .from("sds_course_concepts")
      .select("concept_id")
      .eq("course_id", courseId);

    const conceptIds = (courseConceptLinks || []).map((row) => row.concept_id);
    if (conceptIds.length) {
      const { data: concepts } = await supabase
        .from("sds_concepts")
        .select("id,title,canonical_key")
        .in("id", conceptIds);

      const scored = (concepts || [])
        .map((concept) => {
          const words = String(concept.title)
            .toLowerCase()
            .split(/[^a-záéíóúñ0-9]+/i)
            .filter((word) => word.length >= 4);
          const score = words.reduce(
            (sum, word) => sum + (sample.includes(word) ? 1 : 0),
            0
          );
          return { ...concept, score };
        })
        .filter((concept) => concept.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      if (scored.length) {
        const { error: conceptError } = await supabase
          .from("sds_reading_unit_concepts")
          .insert(
            scored.map((concept, index) => ({
              reading_unit_id: unitId,
              concept_id: concept.id,
              role: index === 0 ? "core" : "extension",
              weight: index === 0 ? 1 : 0.7,
            }))
          );
        if (conceptError) throw conceptError;
      }
    }

    const { error: artifactError } = await supabase
      .from("sds_reading_artifacts")
      .insert({
        reading_unit_id: unitId,
        artifact_type: "orientation_letter",
        title: "Carta de entrada — lectura privada",
        generated_from: "private_ingestion",
        content: {
          body:
            "No intentes cubrir todo el documento de una sola vez. Usa SÓCRATES AI para delimitar una pregunta, recuperar las páginas relevantes y después demostrar comprensión sin mirar la fuente.",
          source: originalFilename,
          pages: pageCount,
          chunks: rows.length,
          next_step:
            "Empieza por el Preview inteligente y formula tres preguntas antes de pedir un resumen.",
        },
      });
    if (artifactError) throw artifactError;

    await supabase.rpc("sds_bootstrap_reading_tasks");

    await Promise.all([
      supabase
        .from("sds_reading_sources")
        .update({
          processing_status: "ready",
          processing_error: null,
        })
        .eq("id", sourceId),
      supabase
        .from("sds_source_ingestions")
        .update({
          source_id: sourceId,
          status: "ready",
          page_count: pageCount,
          chunk_count: rows.length,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", ingestion.id),
    ]);

    return json({
      sourceId,
      readingUnitId: unitId,
      title,
      pageCount: pageCount,
      chunkCount: rows.length,
      status: "ready",
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "private_ingestion_failed";

    if (sourceId) {
      await supabase
        .from("sds_reading_sources")
        .update({
          processing_status: "failed",
          processing_error: message.slice(0, 1000),
        })
        .eq("id", sourceId);
    }

    if (unitId) {
      await supabase
        .from("sds_reading_units")
        .update({ active: false })
        .eq("id", unitId);
    }

    await supabase
      .from("sds_source_ingestions")
      .update({
        source_id: sourceId,
        status: "failed",
        error_message: message.slice(0, 1000),
        completed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);

    return json({ error: message }, 500);
  }
}
