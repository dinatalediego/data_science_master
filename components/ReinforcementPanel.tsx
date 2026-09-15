"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  actionLabel,
  type CalibrationProfile,
  type LearningAction,
  type ReinforcementSnapshot,
} from "@/lib/learningActions";

type Props = {
  onOpenAction: (action: LearningAction) => Promise<void>;
  onSnoozeAction: (action: LearningAction) => Promise<void>;
};

const EMPTY: ReinforcementSnapshot = {
  attempts: 0,
  calibrated_concepts: 0,
  overconfident_concepts: 0,
  underconfident_concepts: 0,
  avg_absolute_calibration_gap: 0,
  prerequisite_risks: 0,
  total_deferrals: 0,
  repeated_deferrals: 0,
  due_reviews: 0,
  open_misconceptions: 0,
};

function percent(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function gapLabel(value: number) {
  const points = Math.round(Number(value || 0) * 100);
  if (points > 0) return `+${points} pp`;
  return `${points} pp`;
}

export default function ReinforcementPanel({
  onOpenAction,
  onSnoozeAction,
}: Props) {
  const [snapshot, setSnapshot] = useState<ReinforcementSnapshot>(EMPTY);
  const [calibration, setCalibration] = useState<CalibrationProfile[]>([]);
  const [actions, setActions] = useState<LearningAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");

    const [snapshotResult, calibrationResult, actionsResult] = await Promise.all([
      supabase.rpc("sds_reinforcement_snapshot"),
      supabase.rpc("sds_calibration_profile"),
      supabase.rpc("sds_next_best_learning_actions", { p_limit: 8 }),
    ]);

    const firstError =
      snapshotResult.error || calibrationResult.error || actionsResult.error;

    if (firstError) {
      setStatus(firstError.message);
      setLoading(false);
      return;
    }

    setSnapshot((snapshotResult.data || EMPTY) as ReinforcementSnapshot);
    setCalibration((calibrationResult.data || []) as CalibrationProfile[]);
    setActions((actionsResult.data || []) as LearningAction[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reinforcementActions = useMemo(
    () =>
      actions.filter((action) =>
        [
          "review",
          "misconception",
          "calibration",
          "prerequisite_rescue",
          "deferral_rescue",
          "weak_mastery",
        ].includes(action.action_type)
      ),
    [actions]
  );

  const calibrationHeadline = useMemo(() => {
    if (!snapshot.attempts) {
      return {
        label: "SIN LÍNEA BASE",
        title: "Primero necesitamos intentos reales",
        body:
          "Haz al menos dos intentos por concepto para comparar confianza y autoevaluación. Antes de eso, SÓCRATES no inventa una señal de calibración.",
      };
    }

    if (snapshot.overconfident_concepts > 0) {
      return {
        label: "CALIBRATION GAP",
        title: "Hay confianza que todavía necesita evidencia",
        body:
          "SÓCRATES detectó conceptos donde la confianza promedio supera claramente la autoevaluación. La intervención correcta es una prueba cerrada, no más lectura pasiva.",
      };
    }

    if (snapshot.underconfident_concepts > 0) {
      return {
        label: "HIDDEN STRENGTH",
        title: "Podrías estar subestimando evidencia sólida",
        body:
          "Hay conceptos donde tu autoevaluación supera a tu confianza. Conviene comprobarlos con transferencia antes de asignarles más estudio.",
      };
    }

    return {
      label: "CALIBRATED",
      title: "Confianza y evidencia se están alineando",
      body:
        "No aparece un gap relevante todavía. Mantén la separación entre lo que crees saber y lo que puedes producir sin apoyo.",
    };
  }, [snapshot]);

  if (loading) {
    return <div className="card loading-card">Preparando el Reinforcement Lab…</div>;
  }

  return (
    <section className="panel-stack">
      <div className="reinforcement-hero">
        <div>
          <p className="eyebrow">REINFORCEMENT LAB · V1.1</p>
          <h2>El sistema no te da más contenido. Busca dónde se rompe el aprendizaje.</h2>
          <p>
            Retención vencida, misconceptions, exceso o falta de confianza,
            prerrequisitos débiles y postergaciones repetidas se convierten en
            intervenciones pequeñas y explicables.
          </p>
        </div>

        <div className="reinforcement-orbit">
          <span>Calibration gap</span>
          <strong>{percent(snapshot.avg_absolute_calibration_gap)}</strong>
          <small>promedio absoluto</small>
        </div>
      </div>

      {status ? <div className="error-banner">{status}</div> : null}

      <div className="reinforcement-metrics">
        <article className="card">
          <span>Intentos observados</span>
          <strong>{snapshot.attempts}</strong>
          <small>Necesarios para calibrar confianza.</small>
        </article>
        <article className="card">
          <span>Prerrequisitos en riesgo</span>
          <strong>{snapshot.prerequisite_risks}</strong>
          <small>Conceptos débiles detrás de conceptos más avanzados.</small>
        </article>
        <article className="card">
          <span>Postergaciones</span>
          <strong>{snapshot.total_deferrals}</strong>
          <small>
            {snapshot.repeated_deferrals
              ? `${snapshot.repeated_deferrals} acción(es) ya requieren rescate.`
              : "Sin patrón repetido todavía."}
          </small>
        </article>
        <article className="card">
          <span>Retrieval + misconceptions</span>
          <strong>{snapshot.due_reviews + snapshot.open_misconceptions}</strong>
          <small>
            {snapshot.due_reviews} review(s) · {snapshot.open_misconceptions} misconception(s)
          </small>
        </article>
      </div>

      <article className="calibration-story card">
        <div>
          <p className="eyebrow dark">{calibrationHeadline.label}</p>
          <h3>{calibrationHeadline.title}</h3>
          <p>{calibrationHeadline.body}</p>
        </div>
        <div className="calibration-counts">
          <span>
            <b>{snapshot.calibrated_concepts}</b>
            calibrados
          </span>
          <span>
            <b>{snapshot.overconfident_concepts}</b>
            sobreconfianza
          </span>
          <span>
            <b>{snapshot.underconfident_concepts}</b>
            infraconfianza
          </span>
        </div>
      </article>

      <div className="two-column reinforcement-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow dark">CALIBRATION BY CONCEPT</p>
              <h3>Confianza vs. autoevaluación</h3>
            </div>
          </div>

          {calibration.length ? (
            <div className="calibration-table">
              {calibration
                .slice()
                .sort((a, b) => Math.abs(Number(b.calibration_gap)) - Math.abs(Number(a.calibration_gap)))
                .slice(0, 8)
                .map((item) => (
                  <div className="calibration-row" key={item.concept_id}>
                    <div>
                      <strong>{item.concept_title}</strong>
                      <small>{item.attempts} intento(s)</small>
                    </div>
                    <div className="calibration-bars">
                      <span>
                        <i style={{ width: `${Number(item.avg_confidence) * 100}%` }} />
                        confianza {percent(Number(item.avg_confidence))}
                      </span>
                      <span>
                        <i style={{ width: `${Number(item.avg_self_score) * 100}%` }} />
                        autoeval. {percent(Number(item.avg_self_score))}
                      </span>
                    </div>
                    <div className={`calibration-gap ${item.calibration_state}`}>
                      {gapLabel(Number(item.calibration_gap))}
                      <small>{item.calibration_state}</small>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty-state">
              Todavía no hay intentos suficientes. Entra a SÓCRATES, responde antes de
              mirar la guía y registra confianza + autoevaluación.
            </div>
          )}
        </article>

        <article className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow dark">INTERVENTION QUEUE</p>
              <h3>Lo que conviene reforzar</h3>
            </div>
          </div>

          {reinforcementActions.length ? (
            <div className="reinforcement-actions">
              {reinforcementActions.slice(0, 6).map((action, index) => {
                const key = `${action.action_type}-${action.entity_id || index}`;
                return (
                  <div className="reinforcement-action" key={key}>
                    <div className="reinforcement-action-top">
                      <span>{actionLabel(action.action_type)}</span>
                      <b>{Math.round(Number(action.priority_score))}</b>
                    </div>
                    <strong>{action.title}</strong>
                    <p>{action.reason}</p>
                    <small>≈ {action.estimated_minutes} min</small>
                    <div className="reinforcement-action-buttons">
                      <button
                        className="primary-button"
                        type="button"
                        disabled={busyKey === key}
                        onClick={async () => {
                          setBusyKey(key);
                          await onOpenAction(action);
                          setBusyKey("");
                        }}
                      >
                        Empezar →
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={busyKey === key}
                        onClick={async () => {
                          setBusyKey(key);
                          await onSnoozeAction(action);
                          await load();
                          setBusyKey("");
                        }}
                      >
                        Posponer 24h
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              No hay una intervención correctiva todavía. Eso no significa mastery:
              significa que aún falta evidencia suficiente para diagnosticar un problema.
            </div>
          )}
        </article>
      </div>

      <article className="reinforcement-contract card">
        <div>
          <p className="eyebrow dark">HOW THE ENGINE THINKS</p>
          <h3>Más fricción útil, menos deuda invisible.</h3>
        </div>
        <div className="reinforcement-rules">
          <span><b>01</b> Retrieval vencido gana a contenido nuevo.</span>
          <span><b>02</b> Una misconception abierta se corrige antes de subir dificultad.</span>
          <span><b>03</b> Dos postergaciones convierten la tarea en un rescate de 10 min.</span>
          <span><b>04</b> Un gap de confianza dispara diagnóstico, no felicitación.</span>
          <span><b>05</b> Si falla un concepto avanzado, se inspecciona primero su prerrequisito.</span>
        </div>
      </article>
    </section>
  );
}
