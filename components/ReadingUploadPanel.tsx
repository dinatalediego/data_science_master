"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/lib/types";

type Props = {
  courses: Course[];
  onComplete: (result: {
    readingUnitId: string;
    sourceId: string;
    pageCount: number;
    chunkCount: number;
    courseId: string;
  }) => void | Promise<void>;
};

function sanitizeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export default function ReadingUploadPanel({ courses, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courses, courseId]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !courseId || !title.trim()) {
      setStatus("Selecciona curso, título y PDF.");
      return;
    }

    if (file.type !== "application/pdf") {
      setStatus("Por ahora SÓCRATES ingiere únicamente PDFs.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setStatus("El PDF supera el límite actual de 25 MB.");
      return;
    }

    setBusy(true);
    setStatus("Subiendo PDF privado…");

    let storagePath = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) throw new Error("Tu sesión expiró. Vuelve a ingresar.");

      const safeName = sanitizeFilename(file.name || "reading.pdf");
      storagePath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("sds-readings")
        .upload(storagePath, file, {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setStatus("Leyendo páginas, creando chunks y preparando la misión…");

      const response = await fetch("/api/reading-ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storagePath,
          courseId,
          title: title.trim(),
          originalFilename: file.name,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo procesar el PDF.");
      }

      setStatus(
        `Listo: ${payload.pageCount} páginas → ${payload.chunkCount} fragmentos source-grounded.`
      );

      await onComplete({
        readingUnitId: payload.readingUnitId,
        sourceId: payload.sourceId,
        pageCount: payload.pageCount,
        chunkCount: payload.chunkCount,
        courseId,
      });

      setFile(null);
      setTitle("");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "No se pudo ingerir la lectura.";
      setStatus(message);

      if (storagePath) {
        await supabase.storage.from("sds-readings").remove([storagePath]);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="private-upload-launch"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span>＋</span>
        <div>
          <strong>Añadir una lectura privada</strong>
          <small>
            PDF → páginas → chunks → Reading Mission → SÓCRATES AI.
          </small>
        </div>
        <b>Private</b>
      </button>
    );
  }

  return (
    <article className="private-upload card">
      <div className="private-upload-heading">
        <div>
          <p className="eyebrow dark">PRIVATE INGESTION · V0.8</p>
          <h3>Convierte un PDF en una misión de aprendizaje.</h3>
          <p>
            El archivo se guarda en un bucket privado bajo tu identidad. SÓCRATES
            extrae texto por página, conserva locators y crea un checklist activo.
          </p>
        </div>
        <button className="text-button" type="button" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>

      <form className="private-upload-form" onSubmit={submit}>
        <label>
          Curso
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            required
          >
            {courses.map((course) => (
              <option value={course.id} key={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Título de la lectura
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej. Paper sobre calibration y uncertainty"
            required
            maxLength={180}
          />
        </label>

        <label className="private-file-field">
          PDF privado
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
          />
          <small>
            Máximo 25 MB. PDFs con texto seleccionable. Escaneos sin capa de texto
            necesitarán OCR en una versión posterior.
          </small>
        </label>

        <div className="private-upload-summary">
          <span>Curso: {selectedCourse?.name || "—"}</span>
          <span>
            Archivo: {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "—"}
          </span>
        </div>

        <div className="private-upload-actions">
          <div>
            <strong>Privacidad</strong>
            <span>Solo tu usuario puede leer el objeto y sus chunks.</span>
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Procesando…" : "Crear Reading Mission →"}
          </button>
        </div>

        {status ? <p className="form-status">{status}</p> : null}
      </form>
    </article>
  );
}
