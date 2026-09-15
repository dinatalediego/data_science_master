"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/lib/types";
import ReadingCoachPanel from "@/components/ReadingCoachPanel";
import ReadingUploadPanel from "@/components/ReadingUploadPanel";
import StudyPackPanel from "@/components/StudyPackPanel";

type ReadingSource = {
  id: string;
  title: string;
  author: string | null;
  institution_or_publisher: string | null;
  publication_year: number | null;
  source_kind: string;
  external_url: string | null;
  access_note: string | null;
};

type ExternalResource = {
  id: string;
  title: string;
  institution: string;
  url: string;
  access_type: string;
};

type ReadingUnit = {
  id: string;
  slug: string;
  course_id: string;
  source_id: string | null;
  external_resource_id: string | null;
  week_label: string;
  sequence: number;
  title: string;
  source_locator: string | null;
  objective: string;
  why_it_matters: string;
  estimated_minutes: number;
  difficulty: number;
  grounding_status: string;
};

type TaskTemplate = {
  id: string;
  reading_unit_id: string;
  task_key: string;
  sequence: number;
  task_type: string;
  title: string;
  instructions: string;
  evidence_expected: string | null;
  estimated_minutes: number;
  priority: number;
};

type UserTask = {
  id: string;
  template_id: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completed_at: string | null;
  evidence: Record<string, unknown>;
};

type Artifact = {
  id: string;
  reading_unit_id: string;
  artifact_type: string;
  title: string;
  content: Record<string, unknown>;
};

const COURSE_ORDER = [
  "forecasting-for-data-science",
  "matematica-ml-ia",
  "ml-supervisado-fundamentals",
  "ml-supervisado-advanced",
  "ml-no-supervisado",
  "ciberseguridad-ia",
  "proyecto-integrador-tesis",
];

const ARTIFACT_LABELS: Record<string, string> = {
  orientation_letter: "Carta",
  summary: "Resumen",
  concept_cards: "Concept cards",
  infographic: "Infografía",
  checklist: "Checklist",
  derivation_sheet: "Derivación",
  practice_set: "Práctica",
  socratic_prompts: "Preguntas",
};

export default function ReadingRoomPanel({
  userId,
  courses,
}: {
  userId: string;
  courses: Course[];
}) {
  const [units, setUnits] = useState<ReadingUnit[]>([]);
  const [sources, setSources] = useState<ReadingSource[]>([]);
  const [externalResources, setExternalResources] = useState<ExternalResource[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [courseFilter, setCourseFilter] = useState("all");
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [openArtifact, setOpenArtifact] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [evidenceTask, setEvidenceTask] = useState<string | null>(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [confidence, setConfidence] = useState(70);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    setStatus("");

    try {
      await supabase.rpc("sds_bootstrap_reading_tasks");

      const [
        unitsResult,
        sourcesResult,
        externalResult,
        templatesResult,
        tasksResult,
        artifactsResult,
      ] = await Promise.all([
        supabase
          .from("sds_reading_units")
          .select("*")
          .eq("active", true)
          .order("sequence"),
        supabase
          .from("sds_reading_sources")
          .select("*")
          .eq("active", true),
        supabase
          .from("sds_external_resources")
          .select("id,title,institution,url,access_type")
          .eq("active", true),
        supabase
          .from("sds_reading_task_templates")
          .select("*")
          .eq("active", true)
          .order("sequence"),
        supabase
          .from("sds_user_reading_tasks")
          .select("id,template_id,status,completed_at,evidence")
          .eq("user_id", userId),
        supabase
          .from("sds_reading_artifacts")
          .select("*")
          .eq("active", true),
      ]);

      const firstError =
        unitsResult.error ||
        sourcesResult.error ||
        externalResult.error ||
        templatesResult.error ||
        tasksResult.error ||
        artifactsResult.error;

      if (firstError) throw firstError;

      setUnits((unitsResult.data || []) as ReadingUnit[]);
      setSources((sourcesResult.data || []) as ReadingSource[]);
      setExternalResources((externalResult.data || []) as ExternalResource[]);
      setTemplates((templatesResult.data || []) as TaskTemplate[]);
      setTasks((tasksResult.data || []) as UserTask[]);
      setArtifacts((artifactsResult.data || []) as Artifact[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo cargar Reading Room.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  );
  const externalById = useMemo(
    () => new Map(externalResources.map((resource) => [resource.id, resource])),
    [externalResources]
  );
  const taskByTemplate = useMemo(
    () => new Map(tasks.map((task) => [task.template_id, task])),
    [tasks]
  );

  const orderedUnits = useMemo(() => {
    return units
      .filter((unit) => courseFilter === "all" || unit.course_id === courseFilter)
      .slice()
      .sort((a, b) => {
        const courseA = courseById.get(a.course_id)?.slug || "";
        const courseB = courseById.get(b.course_id)?.slug || "";
        const ca = COURSE_ORDER.indexOf(courseA);
        const cb = COURSE_ORDER.indexOf(courseB);
        if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
        return a.sequence - b.sequence;
      });
  }, [units, courseFilter, courseById]);

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  );

  const nextAction = useMemo(() => {
    for (const unit of orderedUnits) {
      const unitTemplates = templates
        .filter((template) => template.reading_unit_id === unit.id)
        .sort((a, b) => a.sequence - b.sequence);

      for (let index = 0; index < unitTemplates.length; index += 1) {
        const template = unitTemplates[index];
        const task = taskByTemplate.get(template.id);
        const previous = index > 0 ? taskByTemplate.get(unitTemplates[index - 1].id) : null;
        const unlocked = index === 0 || previous?.status === "completed";
        if (unlocked && task?.status !== "completed" && task?.status !== "skipped") {
          return { unit, template, task };
        }
      }
    }
    return null;
  }, [orderedUnits, templates, taskByTemplate]);

  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const totalCount = tasks.length;
  const overall = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  async function setTaskState(
    task: UserTask,
    completed: boolean,
    evidence = "",
    confidenceValue: number | null = null
  ) {
    setBusyTask(task.id);
    setStatus("");

    const { data, error } = await supabase.rpc("sds_set_reading_task", {
      p_user_task_id: task.id,
      p_completed: completed,
      p_evidence: evidence.trim() || null,
      p_confidence:
        confidenceValue === null ? null : Math.max(0, Math.min(confidenceValue / 100, 1)),
    });

    if (error) {
      setStatus(error.message);
      setBusyTask(null);
      return;
    }

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: completed ? "completed" : "pending",
              completed_at: completed ? new Date().toISOString() : null,
              evidence: completed
                ? {
                    ...item.evidence,
                    reflection: evidence.trim() || null,
                    confidence:
                      confidenceValue === null ? null : confidenceValue / 100,
                  }
                : item.evidence,
            }
          : item
      )
    );

    const scheduledReviews =
      typeof data === "object" && data && "scheduled_reviews" in data
        ? Number((data as { scheduled_reviews?: number }).scheduled_reviews || 0)
        : 0;

    if (scheduledReviews > 0) {
      setStatus(
        `Misión cerrada. SÓCRATES programó ${scheduledReviews} revisiones T+1/T+3/T+7/T+21.`
      );
    }

    setEvidenceTask(null);
    setEvidenceText("");
    setConfidence(70);
    setBusyTask(null);
  }

  function requestCompletion(task: UserTask, checked: boolean) {
    if (checked) {
      void setTaskState(task, false);
      return;
    }

    setEvidenceTask(task.id);
    const previousReflection =
      typeof task.evidence?.reflection === "string" ? task.evidence.reflection : "";
    setEvidenceText(previousReflection);
    const previousConfidence =
      typeof task.evidence?.confidence === "number"
        ? Math.round(task.evidence.confidence * 100)
        : 70;
    setConfidence(previousConfidence);
  }

  if (loading) {
    return <div className="card loading-card">Preparando tus reading missions…</div>;
  }

  return (
    <section className="panel-stack">
      <div className="reading-hero">
        <div>
          <p className="eyebrow">THE READING ROOM · SOURCE-GROUNDED</p>
          <h2>Lee menos. Recupera más. Demuestra lo que entendiste.</h2>
          <p>
            Cada lectura se convierte en una misión: preview, lectura activa,
            explicación sin mirar y práctica. Lo no marcado no desaparece: se convierte
            en tu siguiente acción.
          </p>
        </div>
        <div className="reading-progress">
          <strong>{overall}%</strong>
          <span>checklist completado</span>
          <small>{completedCount}/{totalCount} acciones</small>
        </div>
      </div>

      <ReadingUploadPanel
        courses={courses}
        onComplete={async (result) => {
          await load();
          setCourseFilter(result.courseId);
          setExpandedUnit(result.readingUnitId);
          window.setTimeout(() => {
            document
              .getElementById(`reading-unit-${result.readingUnitId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 120);
        }}
      />

      {nextAction ? (
        <article className="reading-trigger card">
          <div>
            <p className="eyebrow dark">NEXT TRIGGER</p>
            <h3>{nextAction.template.title}</h3>
            <p>{nextAction.template.instructions}</p>
            <small>
              {courseById.get(nextAction.unit.course_id)?.name} · {nextAction.unit.title}
              {" · "}{nextAction.template.estimated_minutes} min
            </small>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setCourseFilter(nextAction.unit.course_id);
              setExpandedUnit(nextAction.unit.id);
              document
                .getElementById(`reading-unit-${nextAction.unit.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            Continuar misión →
          </button>
        </article>
      ) : (
        <article className="reading-trigger complete card">
          <div>
            <p className="eyebrow dark">QUEUE CLEAR</p>
            <h3>No tienes acciones de lectura pendientes.</h3>
            <p>El siguiente paso debería ser retrieval o transferencia, no más consumo.</p>
          </div>
        </article>
      )}

      <article className="reading-toolbar card">
        <div>
          <p className="eyebrow dark">ROUTES</p>
          <strong>Primeras semanas · 7 cursos</strong>
        </div>
        <label>
          Curso
          <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            <option value="all">Todos los cursos</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
      </article>

      {status ? <div className="error-banner">{status}</div> : null}

      <div className="reading-unit-list">
        {orderedUnits.map((unit) => {
          const course = courseById.get(unit.course_id);
          const source = unit.source_id ? sourceById.get(unit.source_id) : null;
          const external = unit.external_resource_id
            ? externalById.get(unit.external_resource_id)
            : null;
          const unitTemplates = templates
            .filter((template) => template.reading_unit_id === unit.id)
            .sort((a, b) => a.sequence - b.sequence);
          const unitArtifacts = artifacts.filter(
            (artifact) => artifact.reading_unit_id === unit.id
          );
          const completed = unitTemplates.filter(
            (template) => taskByTemplate.get(template.id)?.status === "completed"
          ).length;
          const progress = unitTemplates.length
            ? Math.round((completed / unitTemplates.length) * 100)
            : 0;
          const expanded = expandedUnit === unit.id;

          return (
            <article
              id={`reading-unit-${unit.id}`}
              className="reading-unit card"
              key={unit.id}
            >
              <div className="reading-unit-header">
                <div className="reading-unit-title">
                  <span className={`course-dot large ${course?.color_token || "blue"}`} />
                  <div>
                    <div className="reading-unit-kicker">
                      {course?.name} · {unit.week_label}
                    </div>
                    <h3>{unit.title}</h3>
                  </div>
                </div>
                <div className="reading-unit-score">
                  <strong>{progress}%</strong>
                  <span>{completed}/{unitTemplates.length}</span>
                </div>
              </div>

              <div className="reading-unit-grid">
                <div>
                  <p className="reading-label">Objetivo</p>
                  <p>{unit.objective}</p>
                </div>
                <div>
                  <p className="reading-label">Por qué importa</p>
                  <p>{unit.why_it_matters}</p>
                </div>
              </div>

              <div className="reading-source-line">
                <div>
                  <strong>{source?.title || external?.title || "Fuente curada"}</strong>
                  <span>
                    {source?.author || external?.institution}
                    {unit.source_locator ? ` · ${unit.source_locator}` : ""}
                  </span>
                </div>
                {external?.url || source?.external_url ? (
                  <a href={external?.url || source?.external_url || "#"} target="_blank" rel="noreferrer">
                    Abrir fuente ↗
                  </a>
                ) : (
                  <span className="uploaded-source">Tu copia adjunta</span>
                )}
              </div>

              {unitArtifacts.length ? (
                <div className="artifact-strip">
                  {unitArtifacts.map((artifact) => (
                    <button
                      type="button"
                      key={artifact.id}
                      className={openArtifact === artifact.id ? "active" : ""}
                      onClick={() =>
                        setOpenArtifact(openArtifact === artifact.id ? null : artifact.id)
                      }
                    >
                      {ARTIFACT_LABELS[artifact.artifact_type] || artifact.artifact_type}
                    </button>
                  ))}
                </div>
              ) : null}

              {unitArtifacts.map((artifact) =>
                openArtifact === artifact.id ? (
                  <ArtifactView key={artifact.id} artifact={artifact} />
                ) : null
              )}

              <StudyPackPanel readingUnitId={unit.id} unitTitle={unit.title} />

              <ReadingCoachPanel readingUnitId={unit.id} unitTitle={unit.title} />

              <button
                className="reading-expand"
                type="button"
                onClick={() => setExpandedUnit(expanded ? null : unit.id)}
              >
                {expanded ? "Ocultar checklist" : "Abrir checklist"} · {unit.estimated_minutes} min lectura
              </button>

              {expanded ? (
                <div className="reading-checklist">
                  {unitTemplates.map((template, index) => {
                    const task = taskByTemplate.get(template.id);
                    const previous =
                      index > 0 ? taskByTemplate.get(unitTemplates[index - 1].id) : null;
                    const unlocked = index === 0 || previous?.status === "completed";
                    const checked = task?.status === "completed";

                    return (
                      <div
                        className={`reading-task ${checked ? "done" : ""} ${!unlocked ? "locked" : ""}`}
                        key={template.id}
                      >
                        <button
                          type="button"
                          className="task-check"
                          disabled={!unlocked || !task || busyTask === task.id}
                          onClick={() => task && requestCompletion(task, checked)}
                          aria-label={checked ? "Marcar pendiente" : "Registrar evidencia"}
                        >
                          {checked ? "✓" : index + 1}
                        </button>
                        <div>
                          <div className="reading-task-meta">
                            <span>{template.task_type}</span>
                            <span>{template.estimated_minutes} min</span>
                            {!unlocked ? <span>bloqueado</span> : null}
                            {checked ? <span>evidencia registrada</span> : null}
                          </div>
                          <strong>{template.title}</strong>
                          <p>{template.instructions}</p>
                          {template.evidence_expected ? (
                            <small>Evidencia: {template.evidence_expected}</small>
                          ) : null}

                          {task && evidenceTask === task.id && !checked ? (
                            <div className="task-evidence-form">
                              <label>
                                Evidencia breve
                                <textarea
                                  value={evidenceText}
                                  onChange={(event) => setEvidenceText(event.target.value)}
                                  rows={3}
                                  placeholder={template.evidence_expected || "¿Qué produjiste o pudiste explicar?"}
                                />
                              </label>

                              <label className="confidence-field">
                                <span>
                                  Confianza antes de comprobarlo
                                  <strong>{confidence}%</strong>
                                </span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={confidence}
                                  onChange={(event) => setConfidence(Number(event.target.value))}
                                />
                              </label>

                              <div className="task-evidence-actions">
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() => {
                                    setEvidenceTask(null);
                                    setEvidenceText("");
                                  }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={busyTask === task.id || !evidenceText.trim()}
                                  onClick={() =>
                                    void setTaskState(task, true, evidenceText, confidence)
                                  }
                                >
                                  {busyTask === task.id ? "Guardando…" : "Registrar y completar"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <article className="reading-contract card">
        <div>
          <p className="eyebrow dark">LEARNING CONTRACT</p>
          <h3>“Leído” no significa “aprendido”.</h3>
          <p>
            SÓCRATES solo trata una lectura como cerrada cuando pasas por explicación
            y práctica. El checklist es secuencial: lo pendiente se convierte en la
            siguiente acción visible.
          </p>
        </div>
        <div>
          <span>Preview → pregunta antes de leer</span>
          <span>Read → identifica supuestos y dificultad</span>
          <span>Explain → recupera sin mirar</span>
          <span>Practice → demuestra transferencia</span>
        </div>
      </article>
    </section>
  );
}

function ArtifactView({ artifact }: { artifact: Artifact }) {
  const entries = Object.entries(artifact.content || {});

  return (
    <div className="artifact-view">
      <p className="eyebrow dark">{ARTIFACT_LABELS[artifact.artifact_type] || artifact.artifact_type}</p>
      <h4>{artifact.title}</h4>

      {entries.map(([key, value]) => (
        <div className="artifact-section" key={key}>
          <strong>{humanize(key)}</strong>
          {Array.isArray(value) ? (
            <ul>
              {value.map((item, index) => (
                <li key={index}>{String(item)}</li>
              ))}
            </ul>
          ) : (
            <p>{String(value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
