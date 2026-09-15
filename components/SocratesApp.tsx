"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthPanel from "@/components/AuthPanel";
import TutorPanel from "@/components/TutorPanel";
import LibraryPanel from "@/components/LibraryPanel";
import ReadingRoomPanel from "@/components/ReadingRoomPanel";
import { supabase } from "@/lib/supabase";
import type {
  Concept,
  Course,
  CourseConcept,
  Mastery,
  Misconception,
  ReviewItem,
} from "@/lib/types";

type Tab = "campus" | "courses" | "library" | "reading" | "socrates" | "mastery" | "calendar" | "thesis";

type LearningAction = {
  priority_score: number;
  action_type: "review" | "misconception" | "reading" | "weak_mastery" | "baseline";
  title: string;
  body: string;
  reason: string;
  target_tab: "reading" | "socrates";
  entity_id: string | null;
  course_name: string | null;
  concept_title: string | null;
  estimated_minutes: number;
  due_at: string | null;
};

type NextReadingAction = {
  user_task_id: string;
  reading_unit_id: string;
  course_id: string;
  course_name: string;
  unit_title: string;
  week_label: string;
  task_title: string;
  task_type: string;
  instructions: string;
  estimated_minutes: number;
  source_locator: string | null;
  trigger_reason: string;
};

const DAYS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

function shortTime(value: string) {
  return value.slice(0, 5);
}

function masteryAverage(item?: Mastery) {
  if (!item) return null;
  const values = [
    item.conceptual,
    item.mathematical,
    item.coding,
    item.transfer,
    item.retention,
  ].filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nextCourse(courses: Course[]) {
  if (!courses.length) return null;
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const candidates = courses.map((course) => {
    const [hour, minute] = shortTime(course.start_time).split(":").map(Number);
    let deltaDays = course.day_of_week - currentDay;
    const courseMinutes = hour * 60 + minute;

    if (deltaDays < 0 || (deltaDays === 0 && courseMinutes <= nowMinutes)) {
      deltaDays += 7;
    }

    return {
      course,
      distance: deltaDays * 1440 + courseMinutes - (deltaDays === 0 ? nowMinutes : 0),
    };
  });

  return candidates.sort((a, b) => a.distance - b.distance)[0]?.course || null;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function SocratesApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("campus");
  const [courses, setCourses] = useState<Course[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [courseConcepts, setCourseConcepts] = useState<CourseConcept[]>([]);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [nextReading, setNextReading] = useState<NextReadingAction | null>(null);
  const [learningActions, setLearningActions] = useState<LearningAction[]>([]);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!session?.user.id) return;
    setDataLoading(true);
    setError("");

    try {
      await supabase.rpc("sds_bootstrap_current_user");

      const [
        coursesResult,
        conceptsResult,
        linksResult,
        masteryResult,
        reviewsResult,
        misconceptionsResult,
        nextReadingResult,
        learningActionsResult,
      ] = await Promise.all([
        supabase
          .from("sds_courses")
          .select("*")
          .eq("active", true)
          .order("day_of_week")
          .order("start_time"),
        supabase.from("sds_concepts").select("*").order("title"),
        supabase.from("sds_course_concepts").select("*"),
        supabase
          .from("sds_mastery_states")
          .select("*")
          .eq("user_id", session.user.id),
        supabase
          .from("sds_review_items")
          .select("*")
          .eq("user_id", session.user.id)
          .order("due_at"),
        supabase
          .from("sds_misconceptions")
          .select("*")
          .eq("user_id", session.user.id)
          .in("status", ["open", "improving", "reopened"])
          .order("severity", { ascending: false }),
        supabase.rpc("sds_next_reading_action"),
        supabase.rpc("sds_next_best_learning_actions", { p_limit: 3 }),
      ]);

      const firstError =
        coursesResult.error ||
        conceptsResult.error ||
        linksResult.error ||
        masteryResult.error ||
        reviewsResult.error ||
        misconceptionsResult.error ||
        nextReadingResult.error ||
        learningActionsResult.error;

      if (firstError) throw firstError;

      setCourses((coursesResult.data || []) as Course[]);
      setConcepts((conceptsResult.data || []) as Concept[]);
      setCourseConcepts((linksResult.data || []) as CourseConcept[]);
      setMastery((masteryResult.data || []) as Mastery[]);
      setReviews((reviewsResult.data || []) as ReviewItem[]);
      setMisconceptions((misconceptionsResult.data || []) as Misconception[]);
      const readingRows = (nextReadingResult.data || []) as NextReadingAction[];
      setNextReading(readingRows[0] || null);
      setLearningActions((learningActionsResult.data || []) as LearningAction[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el Campus.");
    } finally {
      setDataLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void loadData();
  }, [session, loadData]);

  const masteryByConcept = useMemo(
    () => new Map(mastery.map((item) => [item.concept_id, item])),
    [mastery]
  );

  const conceptById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept])),
    [concepts]
  );

  const dueReviews = useMemo(() => {
    const now = Date.now();
    return reviews.filter(
      (item) =>
        ["scheduled", "due"].includes(item.status) &&
        new Date(item.due_at).getTime() <= now
    );
  }, [reviews]);

  const evidencedConcepts = mastery.filter((item) => item.evidence_count > 0);
  const next = nextCourse(courses);

  const recommendation = useMemo(() => {
    const top = learningActions[0];
    if (top) {
      return {
        kicker:
          top.action_type === "review"
            ? "RETRIEVAL DUE"
            : top.action_type === "misconception"
              ? "MISCONCEPTION"
              : top.action_type === "reading"
                ? "READING TRIGGER"
                : top.action_type === "weak_mastery"
                  ? "WEAKEST EVIDENCE"
                  : "FIRST EVIDENCE",
        title: top.title,
        body: top.body,
        action:
          top.target_tab === "reading" ? "Abrir Reading Room" : "Ir a SÓCRATES",
        reason: top.reason,
        minutes: top.estimated_minutes,
      };
    }

    return {
      kicker: "QUEUE CLEAR",
      title: "No hay una intervención prioritaria pendiente",
      body: "Cuando aparezca evidencia nueva, SÓCRATES volverá a ordenar la cola.",
      action: "Ir a SÓCRATES",
      reason: "No hay candidatos activos en el motor de reglas.",
      minutes: 0,
    };
  }, [learningActions]);

  if (authLoading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">Σ</div>
        <p>Cargando SÓCRATES DS…</p>
      </main>
    );
  }

  if (!session) {
    return <AuthPanel onAuthenticated={() => void supabase.auth.getSession().then(({ data }) => setSession(data.session))} />;
  }

  async function goLearningAction(action?: LearningAction) {
    const selected = action || learningActions[0];

    if (selected) {
      await supabase.rpc("sds_log_learning_action_event", {
        p_action_type: selected.action_type,
        p_entity_id: selected.entity_id,
        p_event_type: "opened",
        p_priority_score: selected.priority_score,
        p_reason: selected.reason,
        p_metadata: {
          course_name: selected.course_name,
          concept_title: selected.concept_title,
          estimated_minutes: selected.estimated_minutes,
        },
      });

      setTab(selected.target_tab);
      return;
    }

    setTab("socrates");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="side-brand">
            <div className="brand-mark small">Σ</div>
            <div>
              <strong>SÓCRATES DS</strong>
              <span>Personal Learning Campus</span>
            </div>
          </div>

          <nav>
            {[
              ["campus", "⌂", "Campus"],
              ["courses", "▦", "Cursos"],
              ["library", "⌘", "Biblioteca"],
              ["reading", "☰", "Reading Room"],
              ["socrates", "Σ", "Sócrates"],
              ["mastery", "◉", "Mastery"],
              ["calendar", "□", "Calendario"],
              ["thesis", "◇", "Tesis"],
            ].map(([value, icon, label]) => (
              <button
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value as Tab)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <span>{session.user.email}</span>
          <button onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow dark">CICLO II · LEARNING OS</p>
            <h1>
              {tab === "campus"
                ? "Campus"
                : tab === "courses"
                  ? "Mis cursos"
                  : tab === "library"
                  ? "Ivy+ Library"
                  : tab === "reading"
                    ? "Reading Room"
                    : tab === "socrates"
                    ? "SÓCRATES"
                    : tab === "mastery"
                      ? "Mastery"
                      : tab === "calendar"
                        ? "Calendario académico"
                        : "Thesis Lab"}
            </h1>
          </div>
          <div className="status-pill">
            <i />
            Supabase live
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {dataLoading && !courses.length ? (
          <div className="loading-card card">Cargando evidencia del Campus…</div>
        ) : null}

        {tab === "campus" ? (
          <section className="panel-stack">
            <div className="hero-dashboard">
              <div>
                <p className="eyebrow">NEXT-BEST LEARNING ACTION</p>
                <h2>{recommendation.title}</h2>
                <p>{recommendation.body}</p>
                <div className="hero-action-meta">
                  <span>{recommendation.minutes ? `≈ ${recommendation.minutes} min` : "Ready"}</span>
                  <span>{recommendation.reason}</span>
                </div>
                <button className="light-button" onClick={() => void goLearningAction()}>
                  {recommendation.action} →
                </button>
              </div>
              <div className="hero-orbit">
                <div>
                  <span>Evidence</span>
                  <strong>{evidencedConcepts.length}</strong>
                  <small>conceptos</small>
                </div>
              </div>
            </div>

            {learningActions.length ? (
              <div className="nba-strip">
                {learningActions.map((action, index) => (
                  <button
                    type="button"
                    key={`${action.action_type}-${action.entity_id || index}`}
                    className={`nba-card ${index === 0 ? "primary" : ""}`}
                    onClick={() => void goLearningAction(action)}
                  >
                    <span className="nba-rank">0{index + 1}</span>
                    <div>
                      <small>{action.action_type.replace("_", " ")}</small>
                      <strong>{action.title}</strong>
                      <p>{action.reason}</p>
                      <b>
                        {action.course_name || action.concept_title || "SÓCRATES"}
                        {" · "}{action.estimated_minutes} min
                      </b>
                    </div>
                    <i>{Math.round(Number(action.priority_score))}</i>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="metrics-grid">
              <Metric
                label="Próxima clase"
                value={next ? DAYS[next.day_of_week] : "—"}
                detail={
                  next
                    ? `${shortTime(next.start_time)} · ${next.name}`
                    : "Sin cursos cargados"
                }
              />
              <Metric
                label="Revisiones vencidas"
                value={String(dueReviews.length)}
                detail={dueReviews.length ? "Prioridad antes de contenido nuevo" : "Cola al día"}
              />
              <Metric
                label="Conceptos con evidencia"
                value={`${evidencedConcepts.length}/${concepts.length}`}
                detail="La cobertura no equivale a mastery"
              />
              <Metric
                label="Misconceptions abiertas"
                value={String(misconceptions.length)}
                detail="Errores útiles que requieren diagnóstico"
              />
            </div>

            <div className="two-column">
              <article className="card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow dark">THIS WEEK</p>
                    <h3>Horario académico</h3>
                  </div>
                  <button className="text-button" onClick={() => setTab("calendar")}>
                    Ver calendario
                  </button>
                </div>
                <div className="schedule-list">
                  {courses.map((course) => (
                    <div className="schedule-row" key={course.id}>
                      <span className={`course-dot ${course.color_token}`} />
                      <div>
                        <strong>{course.name}</strong>
                        <small>
                          {DAYS[course.day_of_week]} · {shortTime(course.start_time)}–
                          {shortTime(course.end_time)}
                        </small>
                      </div>
                      {course.day_of_week === 1 ? (
                        <span className="conflict-mini">overlap</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>

              <article className="card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow dark">EVIDENCE QUEUE</p>
                    <h3>Lo que SÓCRATES está observando</h3>
                  </div>
                </div>

                {mastery.length ? (
                  <div className="evidence-list">
                    {mastery
                      .slice()
                      .sort(
                        (a, b) =>
                          (masteryAverage(a) ?? 0) - (masteryAverage(b) ?? 0)
                      )
                      .slice(0, 5)
                      .map((item) => {
                        const concept = conceptById.get(item.concept_id);
                        const average = masteryAverage(item);
                        return (
                          <div key={item.concept_id} className="evidence-row">
                            <div>
                              <strong>{concept?.title || "Concepto"}</strong>
                              <small>
                                {item.stage} · {item.evidence_count} evidencia(s)
                              </small>
                            </div>
                            <span>
                              {average === null ? "n/a" : `${Math.round(average * 100)}%`}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="empty-state">
                    Insuficiente evidencia. Una sesión de 10–15 minutos en SÓCRATES
                    crea tu primera línea base.
                  </div>
                )}
              </article>
            </div>
          </section>
        ) : null}

        {tab === "courses" ? (
          <section className="panel-stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow dark">7 WORKSPACES</p>
                <h2>Un programa, siete perspectivas</h2>
                <p>
                  Cada curso se conecta por conceptos. La tesis funciona como capa de
                  transferencia, no como una asignatura aislada.
                </p>
              </div>
            </div>

            <div className="course-grid">
              {courses.map((course) => {
                const linked = courseConcepts
                  .filter((link) => link.course_id === course.id)
                  .map((link) => conceptById.get(link.concept_id))
                  .filter((item): item is Concept => Boolean(item));
                return (
                  <article className="course-card card" key={course.id}>
                    <div className="course-top">
                      <span className={`course-dot large ${course.color_token}`} />
                      <span>
                        {DAYS[course.day_of_week]} · {shortTime(course.start_time)}
                      </span>
                    </div>
                    <h3>{course.name}</h3>
                    <p>{course.learning_role}</p>
                    <div className="course-meta">
                      <span>{course.instructor || "Docente por confirmar"}</span>
                      <span>
                        {course.credits ? `${course.credits} créditos` : "Créditos por confirmar"}
                      </span>
                    </div>
                    <div className="concept-chips">
                      {linked.map((concept) => (
                        <span key={concept.id}>{concept.title}</span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "library" ? <LibraryPanel courses={courses} /> : null}

        {tab === "reading" ? (
          <ReadingRoomPanel userId={session.user.id} courses={courses} />
        ) : null}

        {tab === "socrates" ? (
          <TutorPanel userId={session.user.id} courses={courses} onEvidence={loadData} />
        ) : null}

        {tab === "mastery" ? (
          <section className="panel-stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow dark">EVIDENCE, NOT COMPLETION</p>
                <h2>Mapa de dominio</h2>
                <p>
                  Un porcentaje aparece solo cuando existe evidencia. Sin intentos, el
                  sistema muestra “sin evidencia” en lugar de inventar precisión.
                </p>
              </div>
            </div>

            <article className="card mastery-table">
              {concepts.map((concept) => {
                const item = masteryByConcept.get(concept.id);
                const average = masteryAverage(item);
                return (
                  <div className="mastery-row" key={concept.id}>
                    <div className="mastery-name">
                      <strong>{concept.title}</strong>
                      <small>
                        {item ? `${item.stage} · ${item.evidence_count} evidencia(s)` : "Sin evidencia"}
                      </small>
                    </div>
                    <div className="mastery-bar" aria-label={concept.title}>
                      <i style={{ width: `${average === null ? 0 : average * 100}%` }} />
                    </div>
                    <span>{average === null ? "—" : `${Math.round(average * 100)}%`}</span>
                  </div>
                );
              })}
            </article>
          </section>
        ) : null}

        {tab === "calendar" ? (
          <section className="panel-stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow dark">CALENDAR INTELLIGENCE</p>
                <h2>La clase es el centro de un ciclo, no el final</h2>
                <p>
                  El Campus usa el horario canónico para construir preparación,
                  recuperación y transferencia alrededor de cada sesión.
                </p>
              </div>
            </div>

            <div className="calendar-grid">
              {[1, 2, 3, 4, 6].map((day) => (
                <article className="calendar-day card" key={day}>
                  <h3>{DAYS[day]}</h3>
                  {courses
                    .filter((course) => course.day_of_week === day)
                    .map((course) => (
                      <div className="calendar-course" key={course.id}>
                        <span className={`course-dot ${course.color_token}`} />
                        <div>
                          <strong>{course.name}</strong>
                          <small>
                            {shortTime(course.start_time)}–{shortTime(course.end_time)}
                          </small>
                        </div>
                      </div>
                    ))}
                </article>
              ))}
            </div>

            <div className="two-column">
              <article className="card conflict-card">
                <p className="eyebrow dark">CONFLICT DETECTED</p>
                <h3>Lunes 19:00–21:00</h3>
                <p>
                  Forecasting for Data Science y ML Supervisado Advanced se
                  superponen. SÓCRATES no resuelve esto silenciosamente: la estrategia
                  debe registrarse como asistencia + catch-up.
                </p>
              </article>

              <article className="card">
                <p className="eyebrow dark">LEARNING ENVELOPE</p>
                <div className="timeline">
                  <span><b>T−24h</b> diagnóstico + prerrequisitos</span>
                  <span><b>T+1d</b> active recall</span>
                  <span><b>T+3d</b> retrieval</span>
                  <span><b>T+7d</b> transferencia</span>
                  <span><b>T+21d</b> retención</span>
                </div>
              </article>
            </div>

            <article className="integration-note card">
              <div>
                <p className="eyebrow dark">GOOGLE CALENDAR · READ ONLY</p>
                <h3>Integración preparada, sin escrituras automáticas</h3>
                <p>
                  Durante la inicialización se consultó el calendario conectado y no
                  se encontraron eventos académicos con los nombres de estos cursos.
                  Esta web usa el horario canónico interno; no crea ni modifica eventos
                  de Google sin autorización y OAuth propio de la aplicación.
                </p>
              </div>
              <span className="status-badge">Setup checked</span>
            </article>
          </section>
        ) : null}

        {tab === "thesis" ? (
          <section className="panel-stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow dark">BOSS LEVEL</p>
                <h2>La tesis como capa de transferencia</h2>
                <p>
                  Cada curso debe producir una decisión, una evidencia o una técnica
                  reusable en tu investigación.
                </p>
              </div>
            </div>

            <div className="thesis-map">
              <article className="thesis-center card">
                <span>◇</span>
                <h3>Proyecto Integrador / Tesis</h3>
                <p>Pregunta → diseño → evidencia → método → resultado → reproducibilidad.</p>
              </article>
              {courses
                .filter((course) => course.slug !== "proyecto-integrador-tesis")
                .map((course) => (
                  <article className="thesis-node card" key={course.id}>
                    <span className={`course-dot ${course.color_token}`} />
                    <strong>{course.name}</strong>
                    <small>¿Qué cambia en mi tesis si domino este curso?</small>
                  </article>
                ))}
            </div>

            <article className="card thesis-prompts">
              <p className="eyebrow dark">THESIS ADVISOR PROMPTS</p>
              <div>
                <span>¿Qué supuesto introduce esta técnica?</span>
                <span>¿Qué datos necesitarías para falsar tu hipótesis?</span>
                <span>¿Qué leakage invalidaría la conclusión?</span>
                <span>¿Qué debería poder reproducir otra persona?</span>
              </div>
            </article>
          </section>
        ) : null}
      </section>
    </main>
  );
}
