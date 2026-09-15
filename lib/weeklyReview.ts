export type WeeklyLearningSnapshot = {
  week_start: string;
  week_end: string;
  timezone: string;
  sessions: number;
  planned_minutes: number;
  attempts: number;
  evaluated_attempts: number;
  evaluator_coverage: number;
  concepts_touched: number;
  courses_touched: number;
  avg_confidence: number;
  avg_performance: number;
  avg_absolute_calibration_gap: number;
  reading_tasks_completed: number;
  reviews_completed: number;
  actions_opened: number;
  actions_completed: number;
  actions_snoozed: number;
  pending_readings: number;
  due_reviews: number;
  open_misconceptions: number;
  stop_doing: string;
  start_doing: string;
  continue_doing: string;
};

export type WeeklyCourseEvidence = {
  course_id: string;
  course_name: string;
  sessions: number;
  planned_minutes: number;
  attempts: number;
  reading_tasks_completed: number;
  concepts_touched: number;
};

export type WeeklyHistoryPoint = {
  week_start: string;
  week_end: string;
  attempts: number;
  evaluated_attempts: number;
  reading_tasks_completed: number;
  reviews_completed: number;
  actions_completed: number;
  actions_snoozed: number;
  planned_minutes: number;
  avg_confidence: number;
  avg_performance: number;
};

export type InterventionOutcome = {
  action_event_id: string;
  action_type: string;
  concept_id: string;
  concept_title: string;
  intervention_completed_at: string;
  pre_attempt_id: string | null;
  pre_score: number | null;
  pre_score_source: string | null;
  pre_attempt_at: string | null;
  post_attempt_id: string | null;
  post_score: number | null;
  post_score_source: string | null;
  post_attempt_at: string | null;
  observed_delta: number | null;
  outcome_status: "paired" | "post_only" | "no_post_evidence";
};


export type InterventionEffectivenessProfile = {
  action_type: string;
  paired_outcomes: number;
  avg_observed_delta: number | null;
  positive_rate: number;
  stable_rate: number;
  negative_rate: number;
  evaluator_pair_rate: number;
  evidence_state: "insufficient" | "emerging" | "observed";
  interpretation: string;
  last_observed_at: string | null;
};

export type InterventionEffectivenessConcept = {
  concept_id: string;
  concept_title: string;
  action_type: string;
  paired_outcomes: number;
  avg_observed_delta: number | null;
  positive_rate: number;
  evidence_state: "insufficient" | "emerging" | "observed";
  last_observed_at: string | null;
};
