# Meta-Professor Engine — SÓCRATES DS V1.7

## Purpose

Meta-Professor is the orchestration layer above the existing SÓCRATES tutor. Its job is not to generate more content. It decides what the learner should demonstrate next, how much assistance is allowed, and what evidence is required before the curriculum advances.

The first complete vertical is **Applied ML — Decision Intelligence**. The engine itself is domain-agnostic.

## Closed teaching loop

~~~text
Curriculum graph
      ↓
Knowledge state
      ↓
Next teaching move
      ↓
Cold attempt
      ↓
Progressive assistance (only when allowed)
      ↓
Explicit evidence contrast
      ↓
Mastery / misconception / review update
      ↓
Transfer + retention
      ↓
Next teaching move
      ↺
~~~

Meta-Professor reuses existing SÓCRATES evidence. It does not create an opaque parallel mastery score.

## Core objects

- `sds_learning_tracks`: reusable curricula.
- `sds_track_concepts`: ordered concept graph for a track.
- `sds_professor_states`: learner-specific teaching policy/state.
- `sds_professor_missions`: explicit teaching moves.
- `sds_professor_assistance_events`: longitudinal record of help requested and shown.
- Existing `sds_attempts`, `sds_attempt_evaluations`, `sds_mastery_states`, `sds_misconceptions`, `sds_review_items` and `sds_learning_events` remain the evidence backbone.

## Assistance contract

The help ladder is intentionally monotonic:

0. Cold attempt.
1. Socratic question.
2. Conceptual cue.
3. Structure / checklist / equation skeleton / pseudocode.
4. Partial worked step.
5. Reference solution for comparison.

A mission has an `assistance_ceiling`. The API rejects requests above that ceiling and rejects skipped levels. This prevents the interface from turning into an answer dispenser when the learning objective is retrieval, transfer or oral defense.

## Teaching policy V1

`sds_meta_professor_next_mission()` is deterministic and explainable. It prioritizes:

1. Open misconception.
2. Due retrieval review.
3. Concept with no evidence.
4. Weak mastery.
5. Missing transfer.
6. Missing retention.
7. Oral defense when the evidence base is otherwise sufficient.

Later required concepts remain locked while an earlier required concept lacks minimum evidence or remains below the current proficiency gate.

This is intentionally rules-first. Future learned policies must be challengers against this baseline and must demonstrate better learning outcomes before promotion.

## First complete vertical: Applied ML — Decision Intelligence

The 21-node path is:

1. Baselines.
2. Linear regression.
3. Logistic regression.
4. Train / validation / test.
5. Data leakage.
6. Classification metrics.
7. Bias–variance.
8. Regularization.
9. Decision trees.
10. Ensembles / boosting.
11. Calibration.
12. Decision thresholds.
13. Interpretability.
14. Error analysis.
15. Temporal validation.
16. Survival analysis.
17. Causal inference.
18. Uplift / heterogeneous treatment effects.
19. Model drift.
20. Champion / challenger.
21. Prediction → decision → action → outcome.

Each node has an explicit formative question with an answer guide. The guide stays hidden until the learner produces evidence.

## UI

The Campus exposes a **Professor** workspace. It shows:

- evidence coverage, not page completion;
- number of proficient concepts;
- observed autonomy;
- the next teaching move and its reason;
- target dimension and difficulty;
- the maximum assistance level;
- recent missions and longitudinal history.

Starting a mission routes into the existing Tutor, pins the concept/question, and activates the gated assistance ladder.

## Extending to another discipline

Adding a second domain should require data, not a fork of the teaching engine:

1. Define or reuse `sds_concepts`.
2. Create one `sds_learning_tracks` row.
3. Map concepts and sequencing in `sds_track_concepts`.
4. Attach explicit question/reference criteria in `sds_question_bank`.
5. Reuse the same mission policy, evidence model, assistance ladder and longitudinal memory.
6. Only add domain-specific teaching rules when evidence shows the generic policy is insufficient.

Possible next verticals: Econometrics, Time Series, Linear Algebra, Causal Inference, Pricing Economics.

## Evidence and autonomy

A concept does not become proficient because a page was opened. Evidence is derived from attempts and mastery dimensions. Assistance is logged separately so Socrates can distinguish:

- demonstrated knowledge;
- performance under scaffolding;
- autonomous performance;
- transfer;
- retention.

The initial autonomy metric is deliberately simple: completed missions without positive-level assistance divided by completed missions. It should be treated as an observable behavior signal, not a trait or ability label.

## Security

- Catalog tables are authenticated read-only.
- Learner-specific professor tables use RLS with ownership checks.
- Hint generation uses the caller's authenticated Supabase context.
- No service-role key is exposed to browser code.
- Vercel AI Gateway remains server-side.
- Assistance events and missions are user-isolated.

## V1.7 non-goals

- Autonomous high-stakes grading.
- Replacing instructors or official assessment.
- Learned/RL curriculum policy before enough outcome data exists.
- Treating assistance usage as a fixed learner characteristic.
- Unlocking later material merely to maximize engagement.

## Success criteria

The engine is successful when it can show a traceable chain:

~~~text
teaching decision
→ learner attempt
→ assistance used
→ independent contrast
→ updated evidence
→ later transfer/retention
→ next teaching decision
~~~

That trace must remain inspectable at the individual concept level.
