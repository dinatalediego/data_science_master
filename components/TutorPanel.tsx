"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course, Question, SessionMode } from "@/lib/types";
import type { LearningActionType } from "@/lib/learningActions";

type Props = {
  userId: string;
  courses: Course[];
  onEvidence: () => Promise<void>;
  focusConceptId?: string | null;
  focusCourseId?: string | null;
  focusActionType?: LearningActionType | null;
  focusActionEntityId?: string | null;
};

const MODES: { value: SessionMode; label: string; contract: string }[] = [
  {
    value: "socratic",
    label: "Socrático",
    contract: "Primero razonas tú. El sistema revela la guía después de tu intento.",
  },
  {
    value: "feynman",
    label: "Feynman",
    contract: "Explica con tus propias palabras y detecta vacíos en la explicación.",
  },
  {
    value: "examiner",
    label: "Examiner",
    contract: "Sin pistas antes de responder. Luego comparas contra una guía explícita.",
  },
];

function stageFor(mode: SessionMode) {
  if (mode === "feynman") return "explained";
  if (mode === "examiner") return "solved";
  return "recalled";
}

export default function TutorPanel({
  userId,
  courses,
  onEvidence,
  focusConceptId = null,
  focusCourseId = null,
  focusActionType = null,
  focusActionEntityId = null,
}: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [mode, setMode] = useState<SessionMode>("socratic");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [selfScore, setSelfScore] = useState(60);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [focusConceptTitle, setFocusConceptTitle] = useState("");

  const current = questions[questionIndex] || null;
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courses, courseId]
  );

  useEffect(() => {
    if (focusCourseId && focusCourseId !== courseId) {
      setCourseId(focusCourseId);
    }
  }, [focusCourseId, courseId]);

  useEffect(() => {
    if (!focusConceptId) {
      setFocusConceptTitle("");
      return;
    }

    void supabase
      .from("sds_concepts")
      .select("title")
      .eq("id", focusConceptId)
      .maybeSingle()
      .then(({ data }) => setFocusConceptTitle(data?.title || "Concepto objetivo"));
  }, [focusConceptId]);

  useEffect(() => {
    if (!courseId) return;
    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, mode, focusConceptId]);

  async function loadQuestions() {
    setStatus("");
    setSubmitted(false);
    setResponse("");

    let query = supabase
      .from("sds_question_bank")
      .select("id, course_id, concept_id, mode, dimension, prompt, answer_guide, difficulty")
      .eq("course_id", courseId)
      .eq("active", true)
      .eq("mode", mode)
      .order("difficulty");

    if (focusConceptId) {
      query = query.eq("concept_id", focusConceptId);
    }

    let { data, error } = await query;

    if (!error && (!data || data.length === 0) && focusConceptId) {
      const conceptFallback = await supabase
        .from("sds_question_bank")
        .select("id, course_id, concept_id, mode, dimension, prompt, answer_guide, difficulty")
        .eq("course_id", courseId)
        .eq("concept_id", focusConceptId)
        .eq("active", true)
        .order("difficulty");

      data = conceptFallback.data;
      error = conceptFallback.error;
    }

    if (!error && (!data || data.length === 0)) {
      const fallback = await supabase
        .from("sds_question_bank")
        .select("id, course_id, concept_id, mode, dimension, prompt, answer_guide, difficulty")
        .eq("course_id", courseId)
        .eq("active", true)
        .order("difficulty");

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      setQuestions([]);
      setStatus(error.message);
      return;
    }

    setQuestions((data || []) as Question[]);
    setQuestionIndex(0);
  }

  function nextQuestion() {
    if (!questions.length) return;
    setQuestionIndex((value) => (value + 1) % questions.length);
    setResponse("");
    setSubmitted(false);
    setStatus("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!current || !response.trim()) return;

    setBusy(true);
    setStatus("");

    try {
      const { data: session, error: sessionError } = await supabase
        .from("sds_learning_sessions")
        .insert({
          user_id: userId,
          course_id: current.course_id,
          concept_id: current.concept_id,
          mode,
          goal: "Produce learning evidence through deliberate retrieval.",
          planned_minutes: 15,
          ended_at: new Date().toISOString(),
          reflection: null,
          metadata: {
            source: "campus_tutor",
            self_assessed: true,
          },
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      const normalizedScore = selfScore / 100;
      const normalizedConfidence = confidence / 100;

      const { error: attemptError } = await supabase.from("sds_attempts").insert({
        user_id: userId,
        session_id: session.id,
        question_id: current.id,
        concept_id: current.concept_id,
        response_text: response.trim(),
        self_score: normalizedScore,
        confidence: normalizedConfidence,
        feedback: "Self-assessed attempt. Compare with the answer guide before the next review.",
      });

      if (attemptError) throw attemptError;

      if (current.concept_id) {
        const { data: oldMastery } = await supabase
          .from("sds_mastery_states")
          .select("*")
          .eq("user_id", userId)
          .eq("concept_id", current.concept_id)
          .maybeSingle();

        const dimension = current.dimension;
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + (normalizedScore >= 0.8 ? 3 : 1));

        const masteryPayload: Record<string, unknown> = {
          user_id: userId,
          concept_id: current.concept_id,
          stage: stageFor(mode),
          conceptual: oldMastery?.conceptual ?? null,
          mathematical: oldMastery?.mathematical ?? null,
          coding: oldMastery?.coding ?? null,
          transfer: oldMastery?.transfer ?? null,
          retention: oldMastery?.retention ?? null,
          confidence: normalizedConfidence,
          evidence_count: (oldMastery?.evidence_count || 0) + 1,
          last_evidence_at: new Date().toISOString(),
          next_review_at: nextReview.toISOString(),
          explanation: {
            latest_source: "self_assessed_tutor_attempt",
            latest_question_id: current.id,
            warning: "Mastery values are evidence summaries, not official grades.",
          },
        };
        masteryPayload[dimension] = normalizedScore;

        const { error: masteryError } = await supabase
          .from("sds_mastery_states")
          .upsert(masteryPayload, { onConflict: "user_id,concept_id" });

        if (masteryError) throw masteryError;

        const { error: reviewError } = await supabase.from("sds_review_items").insert({
          user_id: userId,
          concept_id: current.concept_id,
          due_at: nextReview.toISOString(),
          interval_days: normalizedScore >= 0.8 ? 3 : 1,
          reason:
            normalizedScore >= 0.8
              ? "Reforzar evidencia después de un intento fuerte."
              : "Recuperación temprana después de evidencia débil.",
          status: "scheduled",
        });

        if (reviewError) throw reviewError;

        if (normalizedScore <= 0.35) {
          await supabase.from("sds_misconceptions").insert({
            user_id: userId,
            concept_id: current.concept_id,
            title: "Concepto requiere diagnóstico",
            description:
              "El learner autoevaluó este intento por debajo de 35%. Revisar razonamiento antes de avanzar.",
            status: "open",
            severity: 3,
          });
        }
      }

      const { error: eventError } = await supabase.from("sds_learning_events").insert({
        user_id: userId,
        course_id: current.course_id,
        concept_id: current.concept_id,
        event_type: "tutor_attempt_submitted",
        payload: {
          question_id: current.id,
          mode,
          dimension: current.dimension,
          confidence: normalizedConfidence,
          self_score: normalizedScore,
        },
      });

      if (eventError) throw eventError;

      if (focusActionType) {
        const { error: actionError } = await supabase.rpc(
          "sds_log_learning_action_event",
          {
            p_action_type: focusActionType,
            p_entity_id: focusActionEntityId,
            p_event_type: "completed",
            p_priority_score: null,
            p_reason: "Learner produced new tutor evidence for the targeted intervention.",
            p_metadata: {
              concept_id: current.concept_id,
              question_id: current.id,
              self_score: normalizedScore,
              confidence: normalizedConfidence,
            },
          }
        );

        if (actionError) throw actionError;

        if (focusActionType === "review" && focusActionEntityId) {
          const { error: reviewCompletionError } = await supabase
            .from("sds_review_items")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", focusActionEntityId)
            .eq("user_id", userId);

          if (reviewCompletionError) throw reviewCompletionError;
        }
      }

      setSubmitted(true);
      setStatus("Evidencia guardada. Ahora compara tu razonamiento con la guía.");
      await onEvidence();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar la evidencia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow dark">ADAPTIVE PRACTICE</p>
          <h2>SÓCRATES</h2>
          <p>
            La primera versión deliberadamente no finge saber si tu respuesta es
            correcta. Produce evidencia, separa confianza de desempeño y deja una
            revisión programada.
          </p>
        </div>
      </div>

      {focusConceptId ? (
        <article className="targeted-intervention card">
          <div>
            <p className="eyebrow dark">TARGETED INTERVENTION</p>
            <h3>{focusConceptTitle || "Concepto objetivo"}</h3>
            <p>
              SÓCRATES llegó aquí desde una recomendación priorizada. Busca evidencia
              específica para este concepto antes de devolverte a contenido nuevo.
            </p>
          </div>
          <span>{focusActionType?.replaceAll("_", " ") || "focused practice"}</span>
        </article>
      ) : null}

      <div className="tutor-setup card">
        <label>
          Curso
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modo
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as SessionMode)}
          >
            {MODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mode-contract">
          {MODES.find((item) => item.value === mode)?.contract}
        </div>
      </div>

      <form className="question-card card" onSubmit={submit}>
        <div className="question-meta">
          <span>{selectedCourse?.name}</span>
          {current ? (
            <>
              <span>{current.dimension}</span>
              <span>Dificultad {current.difficulty}/5</span>
            </>
          ) : null}
        </div>

        {current ? (
          <>
            <h3>{current.prompt}</h3>

            <label>
              Tu razonamiento
              <textarea
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                rows={7}
                placeholder="Escribe antes de buscar la respuesta. Una explicación imperfecta produce más evidencia que una respuesta copiada."
                disabled={submitted}
              />
            </label>

            {!submitted ? (
              <div className="rating-grid">
                <label>
                  Confianza: <b>{confidence}%</b>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidence}
                    onChange={(event) => setConfidence(Number(event.target.value))}
                  />
                </label>
                <label>
                  Autoevaluación: <b>{selfScore}%</b>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selfScore}
                    onChange={(event) => setSelfScore(Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}

            {submitted ? (
              <div className="answer-guide">
                <p className="eyebrow dark">GUÍA DE CONTRASTE</p>
                <p>{current.answer_guide || "No hay guía disponible para esta pregunta."}</p>
                <p className="microcopy">
                  Esta guía no convierte tu autoevaluación en una nota oficial. Úsala
                  para identificar qué faltó en tu explicación.
                </p>
              </div>
            ) : null}

            <div className="button-row">
              {!submitted ? (
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? "Guardando…" : "Registrar evidencia"}
                </button>
              ) : (
                <button className="primary-button" type="button" onClick={nextQuestion}>
                  Siguiente pregunta
                </button>
              )}
              <button className="secondary-button" type="button" onClick={nextQuestion}>
                Cambiar pregunta
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            No hay preguntas todavía para esta combinación. Cambia de modo o curso.
          </div>
        )}

        {status ? <p className="form-status">{status}</p> : null}
      </form>
    </section>
  );
}
