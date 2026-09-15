"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatAcademicDate, startOfAcademicTerm } from "@/lib/academicTerm";

type ReadinessRow = {
  course_id: string;
  course_slug: string;
  course_name: string;
  day_of_week: number;
  start_time: string;
  concepts_total: number;
  concepts_with_evidence: number;
  attempts_total: number;
  available_questions: number;
  pending_reading_tasks: number;
  source_grounded_units: number;
  source_grounded_pending_tasks: number;
  has_schedule_conflict: boolean;
  readiness_state:
    | "baseline_missing"
    | "attempt_without_concept_evidence"
    | "early_evidence"
    | "foundation_open"
    | "evidence_started";
  next_step: string;
};

type Props = {
  daysUntilStart: number;
  onOpenDiagnostic: (courseId: string) => void;
  onOpenReading: () => void;
  onOpenCalendar: () => void;
};

const STATE_LABELS: Record<ReadinessRow["readiness_state"], string> = {
  baseline_missing: "Baseline pendiente",
  attempt_without_concept_evidence: "Falta evidencia conceptual",
  early_evidence: "Evidencia inicial",
  foundation_open: "Fundación abierta",
  evidence_started: "Base iniciada",
};

export default function PreCycleLaunchpad({
  daysUntilStart,
  onOpenDiagnostic,
  onOpenReading,
  onOpenCalendar,
}: Props) {
  const [rows, setRows] = useState<ReadinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("sds_precycle_course_readiness");

      if (cancelled) return;
      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      setRows((data || []) as ReadinessRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const priorities = useMemo(() => {
    const grounded = rows.filter(
      (row) =>
        row.source_grounded_pending_tasks > 0 &&
        ["forecasting-for-data-science", "matematica-ml-ia"].includes(row.course_slug)
    );
    const baseline = rows.filter(
      (row) =>
        row.attempts_total === 0 &&
        row.available_questions > 0 &&
        !grounded.some((item) => item.course_id === row.course_id)
    );
    return [...grounded, ...baseline].slice(0, 3);
  }, [rows]);

  const coursesWithBaseline = rows.filter((row) => row.attempts_total > 0).length;
  const conceptsWithEvidence = rows.reduce(
    (sum, row) => sum + Number(row.concepts_with_evidence || 0),
    0
  );
  const totalConcepts = rows.reduce(
    (sum, row) => sum + Number(row.concepts_total || 0),
    0
  );

  if (loading) {
    return <div className="card loading-card">Preparando tu pre-cycle launchpad…</div>;
  }

  return (
    <section className="precycle-launchpad card">
      <div className="precycle-hero">
        <div>
          <p className="eyebrow dark">PRE-CYCLE LAUNCHPAD · EVIDENCE BEFORE WEEK 1</p>
          <h3>{daysUntilStart} días para llegar a Semana 1 con una línea base real</h3>
          <p>
            El ciclo empieza el {formatAcademicDate(startOfAcademicTerm())}. SÓCRATES
            no llamará “readiness” a tiempo consumido: antes de empezar busca evidencia
            cerrada, fundamentos source-grounded y una estrategia explícita para el
            choque del lunes.
          </p>
        </div>
        <div className="precycle-summary">
          <div>
            <strong>{coursesWithBaseline}/7</strong>
            <span>cursos con baseline</span>
          </div>
          <div>
            <strong>{conceptsWithEvidence}/{totalConcepts || "—"}</strong>
            <span>conceptos con evidencia</span>
          </div>
        </div>
      </div>

      {status ? <div className="error-banner">{status}</div> : null}

      <div className="precycle-priorities">
        <div className="card-heading">
          <div>
            <p className="eyebrow dark">TOP 3 · BOUNDED LAUNCH</p>
            <h3>No intentes “adelantar todo”</h3>
          </div>
          <span>máximo 3 frentes</span>
        </div>

        {priorities.map((row, index) => {
          const sourceFirst = row.source_grounded_pending_tasks > 0;
          return (
            <article className="precycle-priority" key={row.course_id}>
              <span className="precycle-rank">0{index + 1}</span>
              <div>
                <strong>{row.course_name}</strong>
                <p>
                  {sourceFirst
                    ? row.source_grounded_units +
                      " unidad(es) source-grounded · " +
                      row.source_grounded_pending_tasks +
                      " acción(es) pendientes."
                    : row.next_step}
                </p>
                <small>
                  {row.attempts_total} intentos · {row.concepts_with_evidence}/
                  {row.concepts_total} conceptos con evidencia
                </small>
              </div>
              <button
                type="button"
                onClick={() =>
                  sourceFirst ? onOpenReading() : onOpenDiagnostic(row.course_id)
                }
              >
                {sourceFirst ? "Abrir foundation reading" : "Crear baseline"} →
              </button>
            </article>
          );
        })}
      </div>

      <div className="precycle-course-grid">
        {rows.map((row) => (
          <article className="precycle-course" key={row.course_id}>
            <div>
              <span className={"readiness-state " + row.readiness_state}>
                {STATE_LABELS[row.readiness_state]}
              </span>
              {row.has_schedule_conflict ? (
                <span className="precycle-conflict">conflicto horario</span>
              ) : null}
            </div>
            <strong>{row.course_name}</strong>
            <p>{row.next_step}</p>
            <small>
              questions {row.available_questions} · readings pendientes{" "}
              {row.pending_reading_tasks} · evidence {row.concepts_with_evidence}/
              {row.concepts_total}
            </small>
          </article>
        ))}
      </div>

      <div className="precycle-overlap">
        <div>
          <p className="eyebrow dark">WEEK 1 FRICTION</p>
          <strong>Lunes 19:00–21:00 sigue siendo una decisión pendiente</strong>
          <p>
            Forecasting y ML Advanced se superponen. Resolver asistencia + catch-up
            antes del inicio evita convertir Semana 1 en deuda operativa.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={onOpenCalendar}>
          Revisar conflicto →
        </button>
      </div>
    </section>
  );
}
