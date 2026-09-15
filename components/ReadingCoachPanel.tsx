"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const MODES: Array<{ value: Mode; label: string; prompt: string }> = [
  { value: "explain", label: "Explícame", prompt: "Explícame esta unidad desde intuición hasta significado formal." },
  { value: "socratic", label: "Socrático", prompt: "Guíame con una pregunta socrática sin revelarme la respuesta." },
  { value: "quiz", label: "Examíname", prompt: "Créame un mini examen cerrado, de recall a transferencia." },
  { value: "derive", label: "Derivación", prompt: "Reconstruye conmigo la derivación central paso a paso." },
  { value: "apply", label: "Aplicar", prompt: "Conecta esta lectura con un problema real de data science." },
  { value: "summary", label: "Resumen", prompt: "Dame un one-page brief para estudiar activamente." },
  { value: "concept_cards", label: "Cards", prompt: "Genera concept cards con intuición, relación formal y error frecuente." },
  { value: "infographic", label: "Infografía", prompt: "Diseña una infografía textual con nodos, jerarquía y relaciones." },
  { value: "checklist", label: "Checklist", prompt: "Genera un checklist de evidencia observable para dominar esta lectura." },
];

type CoachResponse = {
  text: string;
  citations: string[];
  provider: string;
  model: string | null;
  groundingStatus: "grounded" | "partial" | "insufficient";
  latencyMs: number;
};

export default function ReadingCoachPanel({
  readingUnitId,
  unitTitle,
}: {
  readingUnitId: string;
  unitTitle: string;
}) {
  const [mode, setMode] = useState<Mode>("explain");
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<CoachResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Tu sesión expiró. Vuelve a ingresar al Campus.");
      }

      const selected = MODES.find((item) => item.value === mode);
      const response = await fetch("/api/reading-coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          readingUnitId,
          mode,
          message: message.trim() || selected?.prompt || "",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo consultar SÓCRATES.");
      }

      setAnswer(payload as CoachResponse);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo consultar SÓCRATES."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="coach-launch"
        onClick={() => setOpen(true)}
      >
        <span>Σ</span>
        <div>
          <strong>Estudiar con SÓCRATES AI</strong>
          <small>Preguntas, derivaciones, quizzes y artefactos source-grounded.</small>
        </div>
        <b>→</b>
      </button>
    );
  }

  return (
    <section className="reading-coach">
      <div className="coach-heading">
        <div>
          <p className="eyebrow dark">SOURCE-GROUNDED AI</p>
          <h4>SÓCRATES · {unitTitle}</h4>
          <p>
            Responde desde la evidencia recuperada de esta lectura. Si la fuente no
            soporta algo, debe decirlo.
          </p>
        </div>
        <button className="text-button" type="button" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>

      <div className="coach-modes">
        {MODES.map((item) => (
          <button
            type="button"
            key={item.value}
            className={mode === item.value ? "active" : ""}
            onClick={() => {
              setMode(item.value);
              if (!message.trim()) setMessage(item.prompt);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form className="coach-form" onSubmit={ask}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ej.: ¿por qué stationarity e invertibility no son lo mismo?"
          rows={3}
          maxLength={2000}
        />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Consultando la fuente…" : "Preguntar a SÓCRATES →"}
        </button>
      </form>

      {error ? <div className="error-banner">{error}</div> : null}

      {answer ? (
        <article className="coach-answer">
          <div className="coach-answer-meta">
            <span className={`grounding-badge ${answer.groundingStatus}`}>
              {answer.groundingStatus === "grounded"
                ? "Grounded"
                : answer.groundingStatus === "partial"
                  ? "Partial grounding"
                  : "Insufficient evidence"}
            </span>
            <span>
              {answer.provider === "vercel-ai-gateway"
                ? "AI live"
                : "Source fallback"}
              {" · "}
              {answer.latencyMs} ms
            </span>
          </div>

          <div className="coach-answer-text">{answer.text}</div>

          {answer.citations?.length ? (
            <div className="coach-citations">
              <strong>Evidence locators</strong>
              <div>
                {answer.citations.map((citation) => (
                  <span key={citation}>{citation}</span>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ) : (
        <div className="coach-empty">
          Elige un modo. Puedes pedir una explicación, generar material o hacer que
          SÓCRATES te examine antes de mostrarte respuestas.
        </div>
      )}
    </section>
  );
}
