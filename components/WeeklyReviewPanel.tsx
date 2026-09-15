"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  academicTermStatus,
  endOfAcademicTerm,
  formatAcademicDate,
  startOfAcademicTerm,
} from "@/lib/academicTerm";
import type {
  InterventionOutcome,
  InterventionEffectivenessConcept,
  InterventionEffectivenessProfile,
  WeeklyCourseEvidence,
  WeeklyHistoryPoint,
  WeeklyLearningSnapshot,
} from "@/lib/weeklyReview";

function mondayIso(reference = new Date()) {
  const date = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    12
  );
  const jsDay = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (jsDay - 1));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function shiftIso(value: string, days: number) {
  const date = fromIso(value);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function pct(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function deltaLabel(value: number | null) {
  if (value === null || value === undefined) return "—";
  const points = Math.round(Number(value) * 100);
  return `${points > 0 ? "+" : ""}${points} pp`;
}

const EMPTY: WeeklyLearningSnapshot = {
  week_start: "",
  week_end: "",
  timezone: "America/Lima",
  sessions: 0,
  planned_minutes: 0,
  attempts: 0,
  evaluated_attempts: 0,
  evaluator_coverage: 0,
  concepts_touched: 0,
  courses_touched: 0,
  avg_confidence: 0,
  avg_performance: 0,
  avg_absolute_calibration_gap: 0,
  reading_tasks_completed: 0,
  reviews_completed: 0,
  actions_opened: 0,
  actions_completed: 0,
  actions_snoozed: 0,
  pending_readings: 0,
  due_reviews: 0,
  open_misconceptions: 0,
  stop_doing: "",
  start_doing: "",
  continue_doing: "",
};

export default function WeeklyReviewPanel() {
  const [weekStart, setWeekStart] = useState(mondayIso());
  const [snapshot, setSnapshot] = useState<WeeklyLearningSnapshot>(EMPTY);
  const [courses, setCourses] = useState<WeeklyCourseEvidence[]>([]);
  const [history, setHistory] = useState<WeeklyHistoryPoint[]>([]);
  const [outcomes, setOutcomes] = useState<InterventionOutcome[]>([]);
  const [effectiveness, setEffectiveness] = useState<InterventionEffectivenessProfile[]>([]);
  const [conceptMemory, setConceptMemory] = useState<InterventionEffectivenessConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");

    const [
      snapshotResult,
      coursesResult,
      historyResult,
      outcomesResult,
      effectivenessResult,
      conceptMemoryResult,
    ] = await Promise.all([
        supabase.rpc("sds_weekly_learning_snapshot", {
          p_week_start: weekStart,
        }),
        supabase.rpc("sds_weekly_course_evidence", {
          p_week_start: weekStart,
        }),
        supabase.rpc("sds_weekly_learning_history", {
          p_weeks: 8,
        }),
        supabase.rpc("sds_intervention_outcomes", {
          p_days: 90,
        }),
        supabase.rpc("sds_intervention_effectiveness_profile", {
          p_days: 180,
        }),
        supabase.rpc("sds_intervention_effectiveness_by_concept", {
          p_days: 180,
          p_min_pairs: 2,
        }),
      ]);

    const firstError =
      snapshotResult.error ||
      coursesResult.error ||
      historyResult.error ||
      outcomesResult.error ||
      effectivenessResult.error ||
      conceptMemoryResult.error;

    if (firstError) {
      setStatus(firstError.message);
      setLoading(false);
      return;
    }

    setSnapshot((snapshotResult.data || EMPTY) as WeeklyLearningSnapshot);
    setCourses((coursesResult.data || []) as WeeklyCourseEvidence[]);
    setHistory((historyResult.data || []) as WeeklyHistoryPoint[]);
    setOutcomes((outcomesResult.data || []) as InterventionOutcome[]);
    setEffectiveness(
      (effectivenessResult.data || []) as InterventionEffectivenessProfile[]
    );
    setConceptMemory(
      (conceptMemoryResult.data || []) as InterventionEffectivenessConcept[]
    );
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const term = academicTermStatus(fromIso(weekStart));
  const totalEvidence =
    snapshot.attempts +
    snapshot.reading_tasks_completed +
    snapshot.reviews_completed;

  const maxCourseActivity = Math.max(
    1,
    ...courses.map(
      (course) =>
        course.attempts + course.reading_tasks_completed + course.sessions
    )
  );

  const chronologicalHistory = useMemo(
    () =>
      history
        .slice()
        .sort(
          (a, b) =>
            fromIso(a.week_start).getTime() - fromIso(b.week_start).getTime()
        ),
    [history]
  );

  const maxHistoryEvidence = Math.max(
    1,
    ...chronologicalHistory.map(
      (item) =>
        item.attempts + item.reading_tasks_completed + item.reviews_completed
    )
  );

  const pairedOutcomes = outcomes.filter(
    (item) => item.outcome_status === "paired"
  );

  function exportWeeklyReview() {
    const courseLines = courses
      .map(
        (course) =>
          `- ${course.course_name}: ${course.attempts} attempt(s), ${course.reading_tasks_completed} reading task(s), ${course.sessions} session(s), ${course.planned_minutes} min.`
      )
      .join("\n");

    const outcomeLines = pairedOutcomes.length
      ? pairedOutcomes
          .slice(0, 12)
          .map(
            (item) =>
              `- ${item.concept_title || "Concepto"} · ${item.action_type}: ${deltaLabel(
                item.observed_delta === null ? null : Number(item.observed_delta)
              )} (observacional, no causal).`
          )
          .join("\n")
      : "- Sin pares pre/post suficientes.";

    const markdown = [
      "# SÓCRATES DS — Weekly Learning Review",
      "",
      `**Semana:** ${snapshot.week_start || weekStart} → ${snapshot.week_end || shiftIso(weekStart, 6)}`,
      `**Timezone:** ${snapshot.timezone}`,
      "",
      "## Evidence",
      `- Attempts: ${snapshot.attempts}`,
      `- Evaluated attempts: ${snapshot.evaluated_attempts} (${pct(snapshot.evaluator_coverage)} coverage)`,
      `- Reading tasks completed: ${snapshot.reading_tasks_completed}`,
      `- Reviews completed: ${snapshot.reviews_completed}`,
      `- Planned minutes: ${snapshot.planned_minutes}`,
      `- Courses touched: ${snapshot.courses_touched}/7`,
      `- Concepts touched: ${snapshot.concepts_touched}`,
      "",
      "## Calibration",
      `- Average confidence: ${pct(snapshot.avg_confidence)}`,
      `- Average effective performance: ${pct(snapshot.avg_performance)}`,
      `- Average absolute gap: ${pct(snapshot.avg_absolute_calibration_gap)}`,
      "",
      "## Learning debt",
      `- Pending readings: ${snapshot.pending_readings}`,
      `- Due reviews: ${snapshot.due_reviews}`,
      `- Open misconceptions: ${snapshot.open_misconceptions}`,
      `- Snoozed actions this week: ${snapshot.actions_snoozed}`,
      "",
      "## Stop / Start / Continue",
      `- **STOP:** ${snapshot.stop_doing}`,
      `- **START:** ${snapshot.start_doing}`,
      `- **CONTINUE:** ${snapshot.continue_doing}`,
      "",
      "## Course coverage",
      courseLines || "- Sin cursos cargados.",
      "",
      "## Intervention outcome ledger",
      "_Observational · not causal._",
      outcomeLines,
      "",
      "---",
      "Generated by SÓCRATES DS. This review summarizes observed learning evidence; it is not an academic grade.",
      "",
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `socrates-weekly-review-${snapshot.week_start || weekStart}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="card loading-card">Preparando tu Weekly Learning Review…</div>;
  }

  return (
    <section className="panel-stack">
      <div className="weekly-review-hero">
        <div>
          <p className="eyebrow">WEEKLY LEARNING REVIEW · V1.3</p>
          <h2>Una semana no se mide por cuánto consumiste, sino por la evidencia que dejó.</h2>
          <p>
            SÓCRATES resume práctica, retrieval, lectura activa, calibración,
            postergaciones y cobertura por curso. La revisión termina en tres decisiones:
            dejar de hacer, empezar a hacer y mantener.
          </p>
        </div>

        <div className="weekly-review-score">
          <span>Evidence units</span>
          <strong>{totalEvidence}</strong>
          <small>
            {snapshot.attempts} attempts · {snapshot.reading_tasks_completed} readings ·{" "}
            {snapshot.reviews_completed} reviews
          </small>
        </div>
      </div>

      <article className="week-selector card">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setWeekStart((value) => shiftIso(value, -7))}
        >
          ← Semana anterior
        </button>

        <div>
          <p className="eyebrow dark">REVIEW WINDOW</p>
          <h3>
            {formatAcademicDate(fromIso(snapshot.week_start || weekStart), {
              year: undefined,
            })}
            {" → "}
            {formatAcademicDate(
              fromIso(snapshot.week_end || shiftIso(weekStart, 6)),
              { year: undefined }
            )}
          </h3>
          <span>
            {term.phase === "before"
              ? "Pre-ciclo · baseline"
              : term.phase === "active"
                ? `Semana académica ${term.currentWeek}`
                : "Post-ciclo"}
            {" · "}
            America/Lima
          </span>
        </div>

        <div className="week-selector-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={weekStart >= mondayIso()}
            onClick={() => setWeekStart((value) => shiftIso(value, 7))}
          >
            Semana siguiente →
          </button>
          <button
            type="button"
            className="text-button weekly-export-button"
            onClick={exportWeeklyReview}
          >
            Exportar portfolio .md
          </button>
        </div>
      </article>

      {status ? <div className="error-banner">{status}</div> : null}

      <div className="weekly-metrics">
        <article className="card">
          <span>Práctica</span>
          <strong>{snapshot.attempts}</strong>
          <small>
            {snapshot.evaluated_attempts} con contraste independiente ·{" "}
            {pct(snapshot.evaluator_coverage)} coverage
          </small>
        </article>
        <article className="card">
          <span>Tiempo planificado</span>
          <strong>{snapshot.planned_minutes}m</strong>
          <small>{snapshot.sessions} sesión(es) registradas</small>
        </article>
        <article className="card">
          <span>Cobertura</span>
          <strong>{snapshot.courses_touched}/7</strong>
          <small>{snapshot.concepts_touched} concepto(s) tocados</small>
        </article>
        <article className="card">
          <span>Learning debt</span>
          <strong>
            {snapshot.due_reviews +
              snapshot.open_misconceptions +
              snapshot.actions_snoozed}
          </strong>
          <small>
            {snapshot.due_reviews} retrieval · {snapshot.open_misconceptions} misconception ·{" "}
            {snapshot.actions_snoozed} snooze
          </small>
        </article>
      </div>

      <div className="weekly-decision-grid">
        <article className="weekly-decision stop card">
          <span>STOP DOING</span>
          <p>{snapshot.stop_doing}</p>
        </article>
        <article className="weekly-decision start card">
          <span>START DOING</span>
          <p>{snapshot.start_doing}</p>
        </article>
        <article className="weekly-decision continue card">
          <span>CONTINUE</span>
          <p>{snapshot.continue_doing}</p>
        </article>
      </div>

      <div className="two-column weekly-evidence-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow dark">CALIBRATION</p>
              <h3>Confianza vs. evidencia efectiva</h3>
            </div>
          </div>

          {snapshot.attempts ? (
            <div className="weekly-calibration">
              <div>
                <span>Confianza</span>
                <strong>{pct(snapshot.avg_confidence)}</strong>
                <i>
                  <b style={{ width: `${snapshot.avg_confidence * 100}%` }} />
                </i>
              </div>
              <div>
                <span>Evidencia</span>
                <strong>{pct(snapshot.avg_performance)}</strong>
                <i>
                  <b style={{ width: `${snapshot.avg_performance * 100}%` }} />
                </i>
              </div>
              <div className="weekly-gap">
                <span>Gap absoluto promedio</span>
                <strong>{pct(snapshot.avg_absolute_calibration_gap)}</strong>
                <small>
                  Score efectivo = evaluador cuando tiene confianza suficiente; si no,
                  autoevaluación explícita.
                </small>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Esta semana todavía no tiene intentos. El panel no inventa una señal de
              calibración.
            </div>
          )}
        </article>

        <article className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow dark">BACKLOG NOW</p>
              <h3>Deuda de aprendizaje visible</h3>
            </div>
          </div>
          <div className="weekly-backlog">
            <div>
              <strong>{snapshot.pending_readings}</strong>
              <span>acciones Reading Room pendientes</span>
            </div>
            <div>
              <strong>{snapshot.due_reviews}</strong>
              <span>reviews vencidos</span>
            </div>
            <div>
              <strong>{snapshot.open_misconceptions}</strong>
              <span>misconceptions abiertas</span>
            </div>
            <div>
              <strong>{snapshot.actions_snoozed}</strong>
              <span>acciones pospuestas esta semana</span>
            </div>
          </div>
        </article>
      </div>

      <article className="card weekly-course-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow dark">COURSE COVERAGE</p>
            <h3>¿Dónde quedó evidencia esta semana?</h3>
          </div>
          <span>
            ciclo: {formatAcademicDate(startOfAcademicTerm())} →{" "}
            {formatAcademicDate(endOfAcademicTerm())}
          </span>
        </div>

        <div className="weekly-course-list">
          {courses.map((course) => {
            const activity =
              course.attempts + course.reading_tasks_completed + course.sessions;
            return (
              <div className="weekly-course-row" key={course.course_id}>
                <div>
                  <strong>{course.course_name}</strong>
                  <small>
                    {course.attempts} attempt · {course.reading_tasks_completed} reading ·{" "}
                    {course.sessions} session
                  </small>
                </div>
                <div className="weekly-course-bar">
                  <i
                    style={{
                      width: `${Math.max(
                        activity ? 8 : 0,
                        (activity / maxCourseActivity) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span>{course.planned_minutes}m</span>
              </div>
            );
          })}
        </div>
      </article>

      <article className="card weekly-history-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow dark">8-WEEK TRACE</p>
            <h3>La trayectoria, no una semana aislada</h3>
          </div>
        </div>

        <div className="weekly-history">
          {chronologicalHistory.map((item) => {
            const evidence =
              item.attempts +
              item.reading_tasks_completed +
              item.reviews_completed;
            return (
              <div className="weekly-history-column" key={item.week_start}>
                <div className="weekly-history-bar">
                  <i
                    style={{
                      height: `${Math.max(
                        evidence ? 8 : 2,
                        (evidence / maxHistoryEvidence) * 100
                      )}%`,
                    }}
                  />
                </div>
                <strong>{evidence}</strong>
                <span>
                  {formatAcademicDate(fromIso(item.week_start), {
                    year: undefined,
                    month: "short",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </article>


      <article className="card effectiveness-memory">
        <div className="card-heading">
          <div>
            <p className="eyebrow dark">PERSONAL LEARNING MEMORY · V1.4</p>
            <h3>¿Qué intervenciones parecen ayudarte?</h3>
            <p className="effectiveness-disclaimer">
              Memoria descriptiva basada en pares antes/después. No cambia el ranking
              de recomendaciones y no interpreta asociación como causalidad.
            </p>
          </div>
          <span className="status-badge">Minimum gate · n≥5</span>
        </div>

        {effectiveness.length ? (
          <div className="effectiveness-grid">
            {effectiveness.map((item) => (
              <div className="effectiveness-row" key={item.action_type}>
                <div>
                  <strong>{item.action_type.replaceAll("_", " ")}</strong>
                  <span className={`memory-state ${item.evidence_state}`}>
                    {item.evidence_state}
                  </span>
                </div>
                <div>
                  <span>Pares</span>
                  <strong>{item.paired_outcomes}</strong>
                </div>
                <div>
                  <span>Δ observado</span>
                  <strong>{deltaLabel(
                    item.avg_observed_delta === null
                      ? null
                      : Number(item.avg_observed_delta)
                  )}</strong>
                </div>
                <div>
                  <span>Positivo</span>
                  <strong>{pct(Number(item.positive_rate || 0))}</strong>
                </div>
                <p>{item.interpretation}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            Aún no hay pares antes/después suficientes para aprender qué tipo de
            intervención parece funcionarte mejor. Esto es correcto: SÓCRATES
            esperará evidencia real antes de personalizar por historial.
          </div>
        )}

        {conceptMemory.length ? (
          <div className="concept-memory">
            <strong>Señales emergentes por concepto</strong>
            <div>
              {conceptMemory.slice(0, 6).map((item) => (
                <span key={`${item.concept_id}-${item.action_type}`}>
                  {item.concept_title} · {item.action_type.replaceAll("_", " ")} ·
                  {" "}{item.paired_outcomes} pares · {deltaLabel(
                    item.avg_observed_delta === null
                      ? null
                      : Number(item.avg_observed_delta)
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <article className="card outcome-ledger">
        <div className="card-heading">
          <div>
            <p className="eyebrow dark">INTERVENTION OUTCOME LEDGER</p>
            <h3>¿Qué ocurrió después de intervenir?</h3>
          </div>
          <span className="status-badge">Observational · not causal</span>
        </div>

        {pairedOutcomes.length ? (
          <div className="outcome-list">
            {pairedOutcomes.slice(0, 8).map((item) => (
              <div className="outcome-row" key={item.action_event_id}>
                <div>
                  <strong>{item.concept_title || "Concepto"}</strong>
                  <small>{item.action_type.replaceAll("_", " ")}</small>
                </div>
                <div>
                  <span>Antes</span>
                  <strong>
                    {item.pre_score === null ? "—" : pct(Number(item.pre_score))}
                  </strong>
                  <small>{item.pre_score_source || "—"}</small>
                </div>
                <div>
                  <span>Después</span>
                  <strong>
                    {item.post_score === null ? "—" : pct(Number(item.post_score))}
                  </strong>
                  <small>{item.post_score_source || "—"}</small>
                </div>
                <div className={`outcome-delta ${
                  Number(item.observed_delta || 0) > 0
                    ? "positive"
                    : Number(item.observed_delta || 0) < 0
                      ? "negative"
                      : "neutral"
                }`}>
                  {deltaLabel(
                    item.observed_delta === null
                      ? null
                      : Number(item.observed_delta)
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            Aún no hay pares pre/post suficientes. SÓCRATES no llamará “uplift” a una
            intervención hasta observar evidencia antes y después; incluso entonces la
            relación se mostrará como observacional, no causal.
          </div>
        )}
      </article>
    </section>
  );
}
