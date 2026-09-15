"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/lib/types";

type MatchedEvent = {
  google_event_id: string;
  summary: string;
  start: string | null;
  end: string | null;
  course_id: string;
  course_name: string;
};

type Observation = {
  id: string;
  observed_at: string;
  matched_events: number;
  unmatched_events: number;
  status: string;
  summary: string | null;
  payload: {
    matched?: MatchedEvent[];
    window?: { timeMin: string; timeMax: string };
  } | null;
};

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const TERM_START = "2026-09-14T00:00:00-05:00";
const TERM_END = "2027-01-31T23:59:59-05:00";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(course: Course) {
  const aliases: Record<string, string[]> = {
    "forecasting-for-data-science": ["forecasting", "forecasting for data science"],
    "machine-learning-supervisado-advanced": [
      "machine learning supervisado advanced",
      "ml supervisado advanced",
      "supervisado advanced",
    ],
    "ciberseguridad-de-ia": [
      "ciberseguridad",
      "ciberseguridad de ia",
      "cybersecurity",
      "ai security",
    ],
    "matematica-para-ml-e-ia": [
      "matematica para ml",
      "matematica para ml e ia",
      "matematica",
      "linear algebra",
    ],
    "machine-learning-supervisado-fundamentals": [
      "machine learning supervisado fundamentals",
      "ml supervisado fundamentals",
      "supervisado fundamentals",
    ],
    "machine-learning-no-supervisado": [
      "machine learning no supervisado",
      "ml no supervisado",
      "no supervisado",
      "unsupervised",
    ],
    "proyecto-integrador-tesis": [
      "proyecto integrador",
      "plan de tesis",
      "tesis",
      "thesis",
    ],
  };

  return [
    normalize(course.name),
    ...(aliases[course.slug] || []).map(normalize),
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function matchCourse(summary: string, courses: Course[]) {
  const value = normalize(summary);
  if (!value) return null;

  return (
    courses
      .map((course) => ({
        course,
        score: aliasesFor(course).reduce((best, alias) => {
          if (!alias) return best;
          if (value === alias) return Math.max(best, 100 + alias.length);
          if (value.includes(alias)) return Math.max(best, 50 + alias.length);
          const tokens = alias.split(" ").filter((token) => token.length >= 4);
          const overlap = tokens.filter((token) => value.includes(token)).length;
          return Math.max(best, overlap >= 2 ? overlap * 10 : 0);
        }, 0),
      }))
      .sort((a, b) => b.score - a.score)[0] || null
  );
}

function formatObservedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CalendarSyncPanel({
  userId,
  courses,
}: {
  userId: string;
  courses: Course[];
}) {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [needsPermission, setNeedsPermission] = useState(false);

  const matched = useMemo(
    () => observation?.payload?.matched || [],
    [observation]
  );

  async function loadLatest() {
    const { data } = await supabase
      .from("sds_calendar_observations")
      .select("*")
      .eq("user_id", userId)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setObservation((data as Observation | null) || null);
  }

  useEffect(() => {
    void loadLatest();

    const url = new URL(window.location.href);
    if (url.searchParams.get("calendar") === "connected") {
      url.searchParams.delete("calendar");
      window.history.replaceState({}, "", url.toString());
      void syncCalendar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestCalendarPermission() {
    setBusy(true);
    setStatus("Abriendo consentimiento de Google Calendar…");

    const redirectTo = new URL(window.location.href);
    redirectTo.searchParams.set("calendar", "connected");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        scopes: CALENDAR_SCOPE,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });

    if (error) {
      setStatus(error.message);
      setBusy(false);
    }
  }

  async function syncCalendar() {
    setBusy(true);
    setStatus("Leyendo tu calendario en modo read-only…");
    setNeedsPermission(false);

    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) throw new Error("Tu sesión expiró.");

      const providerToken = session.provider_token;
      if (!providerToken) {
        setNeedsPermission(true);
        setStatus("Falta autorizar acceso read-only a Google Calendar.");
        return;
      }

      const params = new URLSearchParams({
        timeMin: TERM_START,
        timeMax: TERM_END,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
        fields:
          "items(id,summary,start,end,status),nextPageToken",
      });

      let pageToken = "";
      const allEvents: Array<{
        id?: string;
        summary?: string;
        status?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }> = [];

      do {
        const pageParams = new URLSearchParams(params);
        if (pageToken) pageParams.set("pageToken", pageToken);

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${pageParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${providerToken}` },
            cache: "no-store",
          }
        );

        if (response.status === 401 || response.status === 403) {
          setNeedsPermission(true);
          throw new Error(
            "Google todavía no concedió calendar.readonly o el token expiró. Reautoriza Calendar y vuelve a sincronizar."
          );
        }

        if (!response.ok) {
          throw new Error(`Google Calendar respondió HTTP ${response.status}.`);
        }

        const payload = await response.json();
        allEvents.push(...(payload.items || []));
        pageToken = payload.nextPageToken || "";
      } while (pageToken);

      const activeEvents = allEvents.filter(
        (event) => event.status !== "cancelled" && event.summary
      );

      const matchedEvents: MatchedEvent[] = [];
      let unmatched = 0;

      for (const event of activeEvents) {
        const candidate = matchCourse(event.summary || "", courses);
        if (!candidate || candidate.score < 20) {
          unmatched += 1;
          continue;
        }

        matchedEvents.push({
          google_event_id: event.id || crypto.randomUUID(),
          summary: event.summary || "Evento académico",
          start: event.start?.dateTime || event.start?.date || null,
          end: event.end?.dateTime || event.end?.date || null,
          course_id: candidate.course.id,
          course_name: candidate.course.name,
        });
      }

      const uniqueMatched = Array.from(
        new Map(
          matchedEvents.map((event) => [
            `${event.google_event_id}:${event.course_id}`,
            event,
          ])
        ).values()
      );

      const summary = uniqueMatched.length
        ? `${uniqueMatched.length} evento(s) académico(s) reconocido(s) en el semestre.`
        : "No encontré eventos que coincidan con los siete cursos.";

      const { data: inserted, error } = await supabase
        .from("sds_calendar_observations")
        .insert({
          user_id: userId,
          source: "google_calendar",
          matched_events: uniqueMatched.length,
          unmatched_events: unmatched,
          status: "observed",
          summary,
          payload: {
            window: { timeMin: TERM_START, timeMax: TERM_END },
            matched: uniqueMatched,
            privacy:
              "Only matched academic events are persisted. Unmatched calendar event details are discarded.",
          },
        })
        .select("*")
        .single();

      if (error) throw error;
      setObservation(inserted as Observation);
      setStatus(summary);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "No se pudo sincronizar Google Calendar."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="calendar-sync card">
      <div className="calendar-sync-heading">
        <div>
          <p className="eyebrow dark">GOOGLE CALENDAR · READ ONLY</p>
          <h3>Sincronización académica controlada</h3>
          <p>
            SÓCRATES puede leer tu calendario principal, reconocer eventos de los
            siete cursos y guardar únicamente coincidencias académicas. Nunca crea,
            edita ni elimina eventos de Google.
          </p>
        </div>
        <span className="status-badge">
          {observation ? "Observed" : "Not synced"}
        </span>
      </div>

      <div className="calendar-sync-actions">
        <button
          className="primary-button"
          type="button"
          disabled={busy}
          onClick={() => void syncCalendar()}
        >
          {busy ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => void requestCalendarPermission()}
        >
          {needsPermission ? "Autorizar Calendar" : "Reautorizar permiso"}
        </button>
      </div>

      {status ? <p className="form-status">{status}</p> : null}

      {observation ? (
        <div className="calendar-observation">
          <div>
            <strong>{observation.matched_events}</strong>
            <span>eventos académicos</span>
          </div>
          <div>
            <strong>{observation.unmatched_events}</strong>
            <span>otros eventos descartados</span>
          </div>
          <div>
            <strong>{formatObservedAt(observation.observed_at)}</strong>
            <span>última observación</span>
          </div>
        </div>
      ) : null}

      {matched.length ? (
        <div className="calendar-matches">
          {matched.slice(0, 12).map((event) => (
            <div key={`${event.google_event_id}-${event.course_id}`}>
              <span className="course-dot blue" />
              <div>
                <strong>{event.course_name}</strong>
                <small>
                  {event.start
                    ? new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "medium",
                        timeStyle: event.start.includes("T") ? "short" : undefined,
                        timeZone: "America/Lima",
                      }).format(new Date(event.start))
                    : event.summary}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <p className="calendar-privacy-note">
        Privacidad: los detalles de eventos no académicos no se persisten; solo se
        guarda su conteo agregado.
      </p>
    </article>
  );
}
