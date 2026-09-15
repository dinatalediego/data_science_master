# SÓCRATES DS — Reinforcement Engine V1.1

## Why this exists

A learning operating system should not only rank the next task. It should notice when the learner is avoiding, miscalibrated, or blocked by an unmet prerequisite, then reduce the intervention to the smallest useful action.

V1.1 keeps the decision layer deterministic and explainable. No opaque recommender model is allowed to silently override the rule baseline.

## Priority order

1. overdue spaced retrieval
2. open misconception
3. repeated-deferral rescue
4. calibration diagnostic
5. prerequisite rescue
6. first unlocked Reading Room action
7. weak mastery
8. baseline evidence creation

Every recommendation exposes:
- priority score
- why it fired
- estimated minutes
- target surface
- referenced entity

## Calibration

Calibration is currently computed from learner confidence vs learner self-score on tutor attempts.

This is intentionally labeled **self-calibration**, not objective correctness, because V1.1 does not pretend that self-score is an externally graded performance measure.

Rules:
- fewer than 2 attempts → insufficient evidence
- confidence − self-score >= 0.20 → overconfident
- self-score − confidence >= 0.20 → underconfident
- otherwise → calibrated

Future versions may replace or augment self-score with rubric/AI/human-graded outcomes, but the source of the performance signal must remain explicit.

## Prerequisite rescue

The engine traverses `sds_concept_dependencies`.

If a dependent concept has weak evidence and its prerequisite is unobserved or weak, the system recommends a 12-minute prerequisite rescue instead of assigning more advanced practice.

This prevents a common failure mode: repeatedly practicing the visible error when the actual bottleneck sits lower in the concept graph.

## Deferral-aware behavior

User action state is stored in `sds_learning_action_state`.

A learner can snooze a recommendation for 24 hours. Snoozing:
- writes an auditable `dismissed` action event
- increments the per-action deferral counter
- persists a `snoozed_until` timestamp

After two or more deferrals, the engine can emit a **10-minute rescue**. The goal is not to punish avoidance. The goal is to reduce task size until action becomes feasible.

## Reinforcement Lab

The UI exposes:
- observed attempts
- average absolute calibration gap
- prerequisite risks
- total and repeated deferrals
- overdue review + misconception count
- calibration by concept
- active intervention queue

The panel also explains the rule contract so users can understand why SÓCRATES is intervening.

## Deep-link behavior

Recommendations are not dead cards.

- Reading actions deep-link to the exact Reading Room checklist task.
- Concept-based reinforcement actions focus SÓCRATES on the relevant concept.
- Review actions resolve to the underlying review concept.
- Misconception actions resolve to the linked concept when available.
- Completing a targeted tutor attempt writes a `completed` learning-action event.
- Completing a reading checklist action writes a `completed` reading-action event.

## Product safeguards

- recommendations never increase mastery by themselves
- snoozing never changes mastery
- a completed reading is still distinct from demonstrated retention
- a calibration label requires observed attempts
- prerequisite rescue depends on the explicit concept graph
- all action decisions remain auditable
