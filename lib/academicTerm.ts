import courseConfig from "@/config/courses.json";

export const ACADEMIC_TERM = courseConfig.academic_term;

function parseIsoLocal(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfAcademicTerm() {
  return parseIsoLocal(ACADEMIC_TERM.nominal_start);
}

export function endOfAcademicTerm() {
  return parseIsoLocal(ACADEMIC_TERM.nominal_end);
}

export function formatAcademicDate(date: Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: options?.year ?? "numeric",
    ...options,
  }).format(date);
}

export function academicWeeks(reference = new Date()) {
  const start = startOfAcademicTerm();
  const end = endOfAcademicTerm();
  const today = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    12
  );

  return Array.from({ length: ACADEMIC_TERM.week_count }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    const nominalWeekEnd = addDays(weekStart, 6);
    const weekEnd = nominalWeekEnd > end ? end : nominalWeekEnd;

    const status =
      today < weekStart
        ? "upcoming"
        : today > weekEnd
          ? "completed"
          : "current";

    return {
      week: index + 1,
      start: weekStart,
      end: weekEnd,
      status,
    };
  });
}

export function academicTermStatus(reference = new Date()) {
  const start = startOfAcademicTerm();
  const end = endOfAcademicTerm();
  const today = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    12
  );

  const msPerDay = 86_400_000;

  if (today < start) {
    return {
      phase: "before" as const,
      days: Math.ceil((start.getTime() - today.getTime()) / msPerDay),
      currentWeek: null,
    };
  }

  if (today > end) {
    return {
      phase: "after" as const,
      days: Math.floor((today.getTime() - end.getTime()) / msPerDay),
      currentWeek: null,
    };
  }

  return {
    phase: "active" as const,
    days: 0,
    currentWeek:
      Math.floor((today.getTime() - start.getTime()) / (7 * msPerDay)) + 1,
  };
}

export function nextCourseOccurrence(
  dayOfWeek: number,
  startTime: string,
  reference = new Date()
) {
  const termStart = startOfAcademicTerm();
  const termEnd = endOfAcademicTerm();
  const [hour, minute] = startTime.slice(0, 5).split(":").map(Number);

  const cursor = reference < termStart ? new Date(termStart) : new Date(reference);
  cursor.setSeconds(0, 0);

  const jsDay = cursor.getDay() === 0 ? 7 : cursor.getDay();
  let delta = dayOfWeek - jsDay;

  if (delta < 0) delta += 7;

  let candidate = addDays(cursor, delta);
  candidate.setHours(hour, minute, 0, 0);

  if (candidate < reference || candidate < termStart) {
    candidate = addDays(candidate, 7);
  }

  const endBoundary = new Date(termEnd);
  endBoundary.setHours(23, 59, 59, 999);

  return candidate <= endBoundary ? candidate : null;
}


export function academicWeekSessionDate(
  weekNumber: number,
  dayOfWeek: number,
  startTime: string
) {
  if (
    weekNumber < 1 ||
    weekNumber > ACADEMIC_TERM.week_count ||
    dayOfWeek < 1 ||
    dayOfWeek > 7
  ) {
    return null;
  }

  const termStart = startOfAcademicTerm();
  const termEnd = endOfAcademicTerm();
  const weekStart = addDays(termStart, (weekNumber - 1) * 7);
  const sessionDate = addDays(weekStart, dayOfWeek - 1);
  const [hour, minute] = startTime.slice(0, 5).split(":").map(Number);
  sessionDate.setHours(hour, minute, 0, 0);

  const endBoundary = new Date(termEnd);
  endBoundary.setHours(23, 59, 59, 999);

  return sessionDate <= endBoundary ? sessionDate : null;
}
