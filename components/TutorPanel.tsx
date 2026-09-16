"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course, Question, SessionMode } from "@/lib/types";
import type {
  LearningActionType,
  TutorEvaluationResponse,
} from "@/lib/learningActions";

type Props = {
  userId: string;
  courses: Course[];
  onEvidence: () => Promise<void>;
  focusConceptId?: string | null;
  focusCourseId?: string | null;
  focusActionType?: LearningActionType | null;
  focusActionEntityId?: string | null;
  professorMissionId?: string | null;
  initialMode?: SessionMode | null;
  focusQuestionId?: string | null;
  onProfessorMissionComplete?: () => void;
};

const MODES: { value: SessionMode; label: string; contract: string }[] = [
  {
    value: "socratic",
    label: "Socrático",
    contract: "Primero razonas tú. El sistema revela la guía después de tu intento.",
  },
  {
    value: "professor",
    label: "Professor",
    contract: "Meta-Professor fija el objetivo y limita la ayuda; tú produces la evidencia antes del contraste.",
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
  professorMissionId = null,
  initialMode = null,
  focusQuestionId = null,
  onProfessorMissionComplete,
}: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [mode, setMode] = useState<SessionMode>(initialMode || "socratic");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [selfScore, setSelfScore] = useState(60);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [focusConceptTitle, setFocusConceptTitle] = useState("");
  const [evaluation, setEvaluation] = useState<TutorEvaluationResponse | null>(null);
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState("");
  const [professorMission, setProfessorMission] = useState<{
    track_id: string;
    assistance_ceiling: number;
    mission_type: string;
    objective: string;
  } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintText, setHintText] = useState("");
  const [hintBusy, setHintBusy] = useState(false);

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
    if (initialMode && initialMode !== mode) {
      setMode(initialMode);
    }
  }, [initialMode, mode]);

  useEffect(() => {
    setHintLevel(0);
    setHintText("");

    if (!professorMissionId) {
      setProfessorMission(null);
      return;
    }

    void supabase
      .from("sds_professor_missions")
      .select("track_id,assistance_ceiling,mission_type,objective")
      .eq("id", professorMissionId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) =>
        setProfessorMission(
          data
            ? {
                track_id: String(data.track_id || ""),
                assistance_ceiling: Number(data.assistance_ceiling || 0),
                mission_type: String(data.mission_type || "diagnostic"),
                objective: String(data.objective || ""),
              }
            : null
        )
      );
  }, [professorMissionId, userId]);

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
  }, [courseId, mode, focusConceptId, focusQuestionId]);

  async function loadQuestions() {
    setStatus("");
    setSubmitted(false);
    setResponse("");
    setEvaluation(null);
    setEvaluationStatus("");
    setEvaluationBusy(false);
    setHintLevel(0);
    setHintText("");

    let query = supabase
      .from("sds_question_bank")
      .select("id, course_id, concept_id, mode, dimension, prompt, answer_guide, difficulty")
      .eq("course_id", courseId)
      .eq("active", true)
      .order("difficulty");

    if (focusQuestionId) {
      query = query.eq("id", focusQuestionId);
    } else {
      query = query.eq("mode", mode);
    }

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
    setEvaluation(null);
    setEvaluationStatus("");
    setEvaluationBusy(false);
    setHintLevel(0);
    setHintText("");
  }

  async function requestProfessorHint() {
    if (!current || !professorMissionId || !professorMission) return;

    const nextLevel = hintLevel + 1;
    if (nextLevel > professorMission.assistance_ceiling) {
      setStatus("Esta misión no permite más ayuda antes de producir evidencia.");
      return;
    }

    setHintBusy(true);
    setStatus("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus("La sesión expiró. Vuelve a iniciar sesión para pedir una pista.");
        return;
      }

      const hintResponse = await fetch("/api/professor-hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          missionId: professorMissionId,
          questionId: current.id,
          level: nextLevel,
          draft: response,
        }),
      });

      const payload = await hintResponse.json();
      if (!hintResponse.ok) {
        if (payload?.error === "assistance_ceiling_reached") {
          setStatus("Meta-Professor bloqueó más ayuda para preservar el cold attempt.");
        } else if (payload?.error === "attempt_required_before_hint") {
          setStatus("Escribe primero un intento propio de al menos 20 caracteres. La ayuda se desbloquea después de tu razonamiento inicial.");
        } else {
          setStatus("La pista no estuvo disponible en esta ejecución.");
        }
        return;
      }

      setHintLevel(Number(payload.level || nextLevel));
      setHintText(String(payload.hint || ""));
    } catch {
      setStatus("La pista no estuvo disponible en esta ejecución.");
    } finally {
      setHintBusy(false);
    }
  }

  async function evaluateAttempt(attemptId: string) {
    setEvaluationBusy(true);
    setEvaluationStatus("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setEvaluationStatus(
          "La evaluación independiente no pudo iniciarse porque la sesión expiró. Tu intento sí quedó guardado."
        );
        return;
      }

      const response = await fetch("/api/tutor-evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attemptId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setEvaluationStatus(
          "Tu intento quedó guardado, pero el contraste independiente no estuvo disponible. La autoevaluación sigue como señal provisional."
        );
        return;
      }

      const nextEvaluation = payload as TutorEvaluationResponse;
      setEvaluation(nextEvaluation);

      if (nextEvaluation.effectiveScoreSource === "evaluator") {
        setEvaluationStatus(
          "Contraste independiente guardado. La calibración puede usar este score porque la confianza del evaluador superó el umbral."
        );
      } else {
        setEvaluationStatus(
          "Contraste guardado con confianza insuficiente o no disponible. SÓCRATES conserva tu autoevaluación como fallback explícito."
        );
      }
    } catch {
      setEvaluationStatus(
        "Tu intento quedó guardado. El evaluador no respondió en esta ejecución, así que no se fabricó un score independiente."
      );
    } finally {
      setEvaluationBusy(false);
    }
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

      const { data: attempt, error: attemptError } = await supabase
        .from("sds_attempts")
        .insert({
          user_id: userId,
          session_id: session.id,
          question_id: current.id,
          concept_id: current.concept_id,
          response_text: response.trim(),
          self_score: normalizedScore,
          confidence: normalizedConfidence,
          feedback:
            "Learner self-score recorded separately. Independent evaluation may follow when a guide is available.",
        })
        .select("id")
        .single();

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

      if (professorMissionId) {
        const completedAt = new Date().toISOString();

        const { error: missionError } = await supabase
          .from("sds_professor_missions")
          .update({
            status: "completed",
            completed_at: completedAt,
            outcome: {
              attempt_id: attempt.id,
              question_id: current.id,
              self_score: normalizedScore,
              confidence: normalizedConfidence,
              dimension: current.dimension,
              mode,
              hint_level_used: hintLevel,
            },
          })
          .eq("id", professorMissionId)
          .eq("user_id", userId);

        if (missionError) throw missionError;

        const { error: coldAttemptError } = await supabase
          .from("sds_professor_assistance_events")
          .insert({
            user_id: userId,
            mission_id: professorMissionId,
            level: 0,
            event_type: "cold_attempt",
            metadata: {
              attempt_id: attempt.id,
              question_id: current.id,
              self_score: normalizedScore,
              confidence: normalizedConfidence,
            },
          });

        if (coldAttemptError) throw coldAttemptError;

        let missionTrackId = professorMission?.track_id || "";
        if (!missionTrackId) {
          const { data: missionContext, error: missionContextError } = await supabase
            .from("sds_professor_missions")
            .select("track_id")
            .eq("id", professorMissionId)
            .eq("user_id", userId)
            .single();

          if (missionContextError || !missionContext?.track_id) {
            throw missionContextError || new Error("No se pudo recuperar el track de la misión.");
          }
          missionTrackId = String(missionContext.track_id);
        }

        const { error: professorStateError } = await supabase
          .from("sds_professor_states")
          .upsert(
            {
              user_id: userId,
              track_id: missionTrackId,
              current_concept_id: current.concept_id,
              last_evidence_at: completedAt,
            },
            { onConflict: "user_id,track_id" }
          );

        if (professorStateError) throw professorStateError;

        const { error: professorEventError } = await supabase
          .from("sds_learning_events")
          .insert({
            user_id: userId,
            course_id: current.course_id,
            concept_id: current.concept_id,
            event_type: "meta_professor_mission_completed",
            payload: {
              mission_id: professorMissionId,
              attempt_id: attempt.id,
              hint_level_used: hintLevel,
            },
          });

        if (professorEventError) throw professorEventError;
      }

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
      setStatus(
        "Evidencia guardada. La guía queda visible y SÓCRATES intentará un contraste independiente no oficial."
      );
      setBusy(false);
      await onEvidence();
      await evaluateAttempt(attempt.id);
      await onEvidence();
      if (professorMissionId) {
        onProfessorMissionComplete?.();
      }
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
            Responde primero. SÓCRATES conserva tu confianza y autoevaluación por separado,
            luego intenta contrastar tu respuesta contra la guía explícita. El contraste IA
            es formativo y nunca se presenta como nota oficial.
          </p>
        </div>
      </div>

      {focusConceptId ? (
        <article className="targeted-intervention card">
          <div>
            <p className="eyebrow dark">
              {professorMissionId ? "META-PROFESSOR MISSION" : "TARGETED INTERVENTION"}
            </p>
            <h3>{focusConceptTitle || "Concepto objetivo"}</h3>
            <p>
              {professorMissionId
                ? professorMission?.objective ||
                  "Produce evidencia propia antes de desbloquear ayuda o la referencia."
                : "SÓCRATES llegó aquí desde una recomendación priorizada. Busca evidencia específica para este concepto antes de devolverte a contenido nuevo."}
            </p>
          </div>
          <span>
            {professorMissionId
              ? professorMission?.mission_type?.replaceAll("_", " ") || "mission"
              : focusActionType?.replaceAll("_", " ") || "focused practice"}
          </span>
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

            {professorMissionId && !submitted ? (
              <div className="professor-hint-panel">
                <div>
                  <strong>Assistance ladder</strong>
                  <span>
                    Nivel {hintLevel}/{professorMission?.assistance_ceiling ?? 0}
                  </span>
                </div>
                {hintText ? <p>{hintText}</p> : null}
                <button
                  className="secondary-button"
                  type="button"
                  disabled={
                    hintBusy ||
                    !professorMission ||
                    hintLevel >= professorMission.assistance_ceiling
                  }
                  onClick={() => void requestProfessorHint()}
                >
                  {hintBusy
                    ? "Preparando pista…"
                    : !professorMission || professorMission.assistance_ceiling === 0
                      ? "Misión sin pistas"
                      : hintLevel === 0
                        ? "Pedir pregunta socrática"
                        : "Subir un nivel de ayuda"}
                </button>
              </div>
            ) : null}

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
              <>
                <div className="answer-guide">
                  <p className="eyebrow dark">GUÍA DE CONTRASTE</p>
                  <p>{current.answer_guide || "No hay guía disponible para esta pregunta."}</p>
                  <p className="microcopy">
                    La guía es el criterio explícito de contraste. Tu autoevaluación se
                    conserva y no se sobrescribe.
                  </p>
                </div>

                <div className="evaluator-panel">
                  <div className="evaluator-heading">
                    <div>
                      <p className="eyebrow dark">AI EVIDENCE CONTRAST · NO OFFICIAL GRADE</p>
                      <h4>Contraste independiente</h4>
                    </div>
                    {evaluation?.evaluation.score !== null &&
                    evaluation?.evaluation.score !== undefined ? (
                      <span className={`evaluator-verdict ${evaluation.evaluation.verdict || "insufficient"}`}>
                        {Math.round(Number(evaluation.evaluation.score) * 100)}%
                      </span>
                    ) : null}
                  </div>

                  {evaluationBusy ? (
                    <div className="evaluator-loading">
                      Contrastando tu respuesta contra la guía explícita…
                    </div>
                  ) : null}

                  {evaluation ? (
                    <>
                      <div className="evaluator-meta">
                        <span>
                          verdict · {evaluation.evaluation.verdict || "insufficient"}
                        </span>
                        <span>
                          confianza evaluador ·{" "}
                          {Math.round(
                            Number(evaluation.evaluation.evaluator_confidence || 0) * 100
                          )}
                          %
                        </span>
                        <span>
                          calibration source · {evaluation.effectiveScoreSource}
                        </span>
                      </div>

                      {evaluation.evaluation.strengths?.length ? (
                        <div className="evaluator-list strengths">
                          <strong>Lo que sí quedó demostrado</strong>
                          <ul>
                            {evaluation.evaluation.strengths.map((item, index) => (
                              <li key={`strength-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {evaluation.evaluation.gaps?.length ? (
                        <div className="evaluator-list gaps">
                          <strong>Lo que falta o debe precisarse</strong>
                          <ul>
                            {evaluation.evaluation.gaps.map((item, index) => (
                              <li key={`gap-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {evaluation.evaluation.feedback ? (
                        <div className="evaluator-feedback">
                          <strong>Feedback</strong>
                          <p>{evaluation.evaluation.feedback}</p>
                        </div>
                      ) : null}

                      {evaluation.evaluation.next_prompt ? (
                        <div className="evaluator-next">
                          <strong>Siguiente pregunta sugerida</strong>
                          <p>{evaluation.evaluation.next_prompt}</p>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {evaluationStatus ? (
                    <p className="microcopy evaluator-status">{evaluationStatus}</p>
                  ) : null}
                </div>
              </>
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
