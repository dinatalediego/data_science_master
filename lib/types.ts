export type Course = {
  id: string;
  slug: string;
  name: string;
  instructor: string | null;
  credits: number | null;
  academic_hours: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  learning_role: string;
  color_token: string;
};

export type Concept = {
  id: string;
  canonical_key: string;
  title: string;
  description: string | null;
  difficulty: number;
  tags: string[];
};

export type CourseConcept = {
  course_id: string;
  concept_id: string;
  module: string | null;
  role: string;
};

export type Mastery = {
  user_id: string;
  concept_id: string;
  stage: "seen" | "recalled" | "explained" | "solved" | "applied" | "transferred" | "mastered";
  conceptual: number | null;
  mathematical: number | null;
  coding: number | null;
  transfer: number | null;
  retention: number | null;
  confidence: number | null;
  evidence_count: number;
  last_evidence_at: string | null;
  next_review_at: string | null;
};

export type ReviewItem = {
  id: string;
  concept_id: string;
  due_at: string;
  interval_days: number;
  reason: string | null;
  status: "scheduled" | "due" | "completed" | "skipped";
};

export type Misconception = {
  id: string;
  concept_id: string | null;
  title: string;
  description: string | null;
  status: "open" | "improving" | "resolved" | "reopened";
  severity: number;
};

export type SessionMode =
  | "socratic"
  | "professor"
  | "feynman"
  | "examiner"
  | "coach"
  | "debugger"
  | "researcher"
  | "thesis_advisor"
  | "devils_advocate"
  | "practice"
  | "review"
  | "lab";

export type Question = {
  id: string;
  course_id: string;
  concept_id: string | null;
  mode: SessionMode;
  dimension: "conceptual" | "mathematical" | "coding" | "transfer" | "retention";
  prompt: string;
  answer_guide: string | null;
  difficulty: number;
};
