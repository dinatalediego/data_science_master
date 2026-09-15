export type LearningActionType =
  | "review"
  | "misconception"
  | "reading"
  | "weak_mastery"
  | "baseline"
  | "calibration"
  | "prerequisite_rescue"
  | "deferral_rescue";

export type LearningAction = {
  priority_score: number;
  action_type: LearningActionType;
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

export type ReinforcementSnapshot = {
  attempts: number;
  calibrated_concepts: number;
  overconfident_concepts: number;
  underconfident_concepts: number;
  avg_absolute_calibration_gap: number;
  prerequisite_risks: number;
  total_deferrals: number;
  repeated_deferrals: number;
  due_reviews: number;
  open_misconceptions: number;
};

export type CalibrationProfile = {
  concept_id: string;
  concept_title: string;
  attempts: number;
  avg_confidence: number;
  avg_self_score: number;
  calibration_gap: number;
  calibration_state:
    | "insufficient"
    | "overconfident"
    | "underconfident"
    | "calibrated";
  last_attempt_at: string;
};

export function actionLabel(type: LearningActionType) {
  const labels: Record<LearningActionType, string> = {
    review: "Retrieval",
    misconception: "Misconception",
    reading: "Reading",
    weak_mastery: "Weak evidence",
    baseline: "Baseline",
    calibration: "Calibration",
    prerequisite_rescue: "Prerequisite rescue",
    deferral_rescue: "10-min rescue",
  };
  return labels[type];
}
