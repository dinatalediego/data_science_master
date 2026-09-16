"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SessionMode } from "@/lib/types";

type TrackSummary = {
  track_id: string;
  track_slug: string;
  track_name: string;
  total_concepts: number;
  concepts_with_evidence: number;
  proficient_concepts: number;
  completed_missions: number;
  assisted_missions: number;
  autonomy_ratio: number | null;
};

type ProfessorMission = {
  track_id: string;
  track_slug: string;
  track_name: string;
  concept_id: string;
  concept_title: string;
  course_id: string | null;
  course_name: string | null;
  question_id: string | null;
  sequence: number;
  phase: string;
  mission_type: "diagnostic" | "practice" | "debug" | "transfer" | "retention" | "oral_defense";
  objective: string;
  reason: string;
  target_dimension: "conceptual" | "mathematical" | "coding" | "transfer" | "retention";
  difficulty: number;
  assistance_ceiling: number;
  mastery_average: number;
  evidence_count: number;
  due_review: boolean;
  open_misconception: boolean;
};

type RecentMission = {
  id: string;
  concept_id: string;
  mission_type: ProfessorMission["mission_type"];
  objective: string;
  status: "queued" | "in_progress" | "completed" | "abandoned";
  assistance_ceiling: number;
  created_at: string;
  completed_at: string | null;
  outcome: Record<string, unknown>;
};

type StartPayload = {
  missionId: string;
  conceptId: string;
  courseId: string | null;
  questionId: string | null;
  mode: SessionMode;
  missionType: ProfessorMission["mission_type"];
};

type Props = {
  userId: string;
  onStartMission: (payload: StartPayload) => void;
};

const TRACK_SLUG = "applied-ml-decision-intelligence";

const HELP_LADDER = [
  { level: 0, label: "Cold attempt", detail: "Primero produces una respuesta propia." },
  { level: 1, label: "Pregunta socrática", detail: "Una pregunta que te obliga a localizar el hueco." },
  { level: 2, label: "Pista conceptual", detail: "Señal sobre el concepto, sin resolverlo." },
  { level: 3, label: "Estructura", detail: "Checklist, ecuación o pseudocódigo parcial." },
  { level: 4, label: "Solución parcial", detail: "Solo después de evidencia de intento." },
  { level: 5, label: "Referencia", detail: "Comparación final; nunca como primer paso." },
];

function modeForMission(type: ProfessorMission["mission_type"]): SessionMode {
  if (type === "oral_defense") return "examiner";
  if (type === "transfer") return "feynman";
  if (type === "retention") return "examiner";
  if (type === "debug") return "socratic";
  return "professor";
}

function formatMissionType(value: ProfessorMission["mission_type"]) {
  return value.replaceAll("_", " ");
}

export default function MetaProfessorPanel({ userId, onStartMission }: Props) {
  const [summary, setSummary] = useState<TrackSummary | null>(null);
  const [mission, setMission] = useState<ProfessorMission | null>(null);
  const [recent, setRecent] = useState<RecentMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const [summaryResult, missionResult, recentResult] = await Promise.all([
        supabase
          .rpc("sds_meta_professor_track_summary", { p_track_slug: TRACK_SLUG })
          .maybeSingle(),
        supabase
          .rpc("sds_meta_professor_next_mission", { p_track_slug: TRACK_SLUG })
          .maybeSingle(),
        supabase
          .from("sds_professor_missions")
          .select("id,concept_id,mission_type,objective,status,assistance_ceiling,created_at,completed_at,outcome")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const firstError =
        summaryResult.error || missionResult.error || recentResult.error;
      if (firstError) throw firstError;

      setSummary((summaryResult.data || null) as TrackSummary | null);
      setMission((missionResult.data || null) as ProfessorMission | null);
      setRecent((recentResult.data || []) as RecentMission[]);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el Meta-Professor."
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useMemo(() => {
    if (!summary?.total_concepts) return 0;
    return Math.round(
      (summary.concepts_with_evidence / summary.total_concepts) * 100
    );
  }, [summary]);

  async function startMission() {
    if (!mission) return;
    setStarting(true);
    setStatus("");

    try {
      const { data: existing, error: existingError } = await supabase
        .from("sds_professor_missions")
        .select("id,concept_id,course_id,question_id,mission_type")
        .eq("user_id", userId)
        .eq("track_id", mission.track_id)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        onStartMission({
          missionId: existing.id,
          conceptId: existing.concept_id,
          courseId: existing.course_id,
          questionId: existing.question_id,
          mode: modeForMission(existing.mission_type),
          missionType: existing.mission_type,
        });
        return;
      }

      const now = new Date().toISOString();
      const { data: created, error: createError } = await supabase
        .from("sds_professor_missions")
        .insert({
          user_id: userId,
          track_id: mission.track_id,
          concept_id: mission.concept_id,
          course_id: mission.course_id,
          question_id: mission.question_id,
          mission_type: mission.mission_type,
          objective: mission.objective,
          reason: mission.reason,
          target_dimension: mission.target_dimension,
          difficulty: mission.difficulty,
          assistance_ceiling: mission.assistance_ceiling,
          expected_evidence: {
            target_dimension: mission.target_dimension,
            sequence: mission.sequence,
            phase: mission.phase,
            evidence_policy:
              "attempt_before_help; explicit contrast; transfer and retention required for durable mastery",
          },
          status: "in_progress",
          started_at: now,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      const { error: stateError } = await supabase
        .from("sds_professor_states")
        .upsert(
          {
            user_id: userId,
            track_id: mission.track_id,
            current_concept_id: mission.concept_id,
            status: "active",
            assistance_ceiling: mission.assistance_ceiling,
            last_mission_at: now,
          },
          { onConflict: "user_id,track_id" }
        );

      if (stateError) throw stateError;

      const { error: eventError } = await supabase
        .from("sds_learning_events")
        .insert({
          user_id: userId,
          course_id: mission.course_id,
          concept_id: mission.concept_id,
          event_type: "meta_professor_mission_started",
          payload: {
            mission_id: created.id,
            track_slug: mission.track_slug,
            mission_type: mission.mission_type,
            target_dimension: mission.target_dimension,
            assistance_ceiling: mission.assistance_ceiling,
          },
        });

      if (eventError) throw eventError;

      onStartMission({
        missionId: created.id,
        conceptId: mission.concept_id,
        courseId: mission.course_id,
        questionId: mission.question_id,
        mode: modeForMission(mission.mission_type),
        missionType: mission.mission_type,
      });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "No se pudo iniciar la misión."
      );
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <section className="panel-stack">
        <div className="loading-card card">El Meta-Professor está leyendo tu evidencia…</div>
      </section>
    );
  }

  return (
    <section className="panel-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow dark">LONGITUDINAL · SOCRATIC · EVIDENCE-DRIVEN</p>
          <h2>Meta-Professor</h2>
          <p>
            No te recomienda contenido por consumo. Decide qué debes demostrar ahora,
            qué ayuda está permitida y qué evidencia desbloquea el siguiente nodo.
          </p>
        </div>
      </div>

      <article className="meta-professor-hero card">
        <div>
          <p className="eyebrow dark">FIRST COMPLETE VERTICAL</p>
          <h3>{summary?.track_name || "Applied ML — Decision Intelligence"}</h3>
          <p>
            Baselines → validación → modelado → evaluación → causalidad →
            operación → decisión. El mismo motor podrá alojar después cualquier
            disciplina sin cambiar el modelo pedagógico.
          </p>
        </div>
        <div className="professor-progress">
          <strong>{progress}%</strong>
          <span>cobertura con evidencia</span>
          <i>
            <b style={{ width: `${progress}%` }} />
          </i>
        </div>
      </article>

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Nodos del track</span>
          <strong>{summary?.total_concepts ?? 0}</strong>
          <small>currículo explícito y ordenado</small>
        </article>
        <article className="metric-card">
          <span>Con evidencia</span>
          <strong>{summary?.concepts_with_evidence ?? 0}</strong>
          <small>abrir contenido no cuenta</small>
        </article>
        <article className="metric-card">
          <span>Proficient</span>
          <strong>{summary?.proficient_concepts ?? 0}</strong>
          <small>≥75% de evidencia agregada</small>
        </article>
        <article className="metric-card">
          <span>Autonomía</span>
          <strong>
            {summary?.autonomy_ratio === null || summary?.autonomy_ratio === undefined
              ? "—"
              : `${Math.round(summary.autonomy_ratio * 100)}%`}
          </strong>
          <small>
            {summary?.completed_missions
              ? `${summary.completed_missions} misión(es) observadas`
              : "aún sin misiones cerradas"}
          </small>
        </article>
      </div>

      {mission ? (
        <article className="professor-mission card">
          <div className="professor-mission-top">
            <div>
              <p className="eyebrow dark">NEXT TEACHING MOVE · #{mission.sequence}</p>
              <h3>{mission.concept_title}</h3>
              <p>{mission.objective}</p>
            </div>
            <span className="professor-mission-type">
              {formatMissionType(mission.mission_type)}
            </span>
          </div>

          <div className="professor-mission-grid">
            <div>
              <span>Por qué ahora</span>
              <strong>{mission.reason}</strong>
            </div>
            <div>
              <span>Dimensión objetivo</span>
              <strong>{mission.target_dimension}</strong>
            </div>
            <div>
              <span>Fase</span>
              <strong>{mission.phase}</strong>
            </div>
            <div>
              <span>Ayuda máxima</span>
              <strong>Nivel {mission.assistance_ceiling}/5</strong>
            </div>
          </div>

          <div className="professor-mission-meta">
            <span>Dificultad {mission.difficulty}/5</span>
            <span>{mission.evidence_count} evidencia(s) previas</span>
            <span>
              mastery observado · {Math.round(Number(mission.mastery_average || 0) * 100)}%
            </span>
            {mission.course_name ? <span>{mission.course_name}</span> : null}
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={starting}
            onClick={() => void startMission()}
          >
            {starting ? "Preparando misión…" : "Entrar a la misión →"}
          </button>
        </article>
      ) : (
        <article className="card">
          <p className="eyebrow dark">TRACK CLEAR</p>
          <h3>No hay un nodo prioritario pendiente</h3>
          <p>
            El motor no inventó trabajo adicional. Una nueva evidencia, revisión o
            misconception volverá a abrir la cola.
          </p>
        </article>
      )}

      <div className="two-column">
        <article className="card">
          <p className="eyebrow dark">ASSISTANCE LADDER</p>
          <h3>La IA no empieza resolviendo</h3>
          <div className="professor-help-ladder">
            {HELP_LADDER.map((item) => (
              <div
                key={item.level}
                className={
                  mission && item.level > mission.assistance_ceiling
                    ? "locked"
                    : ""
                }
              >
                <span>{item.level}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                {mission && item.level > mission.assistance_ceiling ? (
                  <b>locked</b>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow dark">LONGITUDINAL MEMORY</p>
          <h3>Misiones recientes</h3>
          {recent.length ? (
            <div className="professor-recent-list">
              {recent.map((item) => (
                <div key={item.id}>
                  <span className={`professor-status ${item.status}`}>
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <div>
                    <strong>{formatMissionType(item.mission_type)}</strong>
                    <small>{item.objective}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              La primera misión creará la memoria longitudinal del Meta-Professor.
            </div>
          )}
        </article>
      </div>

      <article className="integration-note card">
        <div>
          <p className="eyebrow dark">TEACHING CONTRACT</p>
          <h3>Intento → pista → contraste → transferencia → retención</h3>
          <p>
            El progreso se deriva de evidencia existente en SÓCRATES: attempts,
            evaluator feedback, mastery, misconceptions y reviews. Meta-Professor
            orquesta esas piezas; no crea un score paralelo opaco.
          </p>
        </div>
        <span className="status-badge">Engine v1</span>
      </article>

      {status ? <p className="form-status">{status}</p> : null}
    </section>
  );
}
