# SÓCRATES DS — Weekly Learning Review V1.3

## Purpose

The Weekly Learning Review turns SÓCRATES into an observable learning PMO.

The weekly unit is Monday–Sunday in **America/Lima**. The review does not infer progress from time alone. It summarizes observable evidence and current learning debt.

## Weekly evidence

For a selected week the system reports:

- learning sessions;
- planned study minutes;
- tutor attempts;
- independent evaluator coverage;
- average confidence;
- average effective performance;
- average absolute calibration gap;
- completed Reading Room tasks;
- completed spaced reviews;
- opened, completed and snoozed learning actions;
- concepts touched;
- courses touched.

## Current backlog

The weekly panel also shows the current backlog:

- pending/in-progress Reading Room actions;
- overdue reviews;
- open misconceptions;
- weekly snoozes.

Backlog is deliberately separated from completed weekly evidence.

## Stop / Start / Continue

The review ends in deterministic recommendations.

Examples:

- repeated snoozes → stop accumulating large deferred tasks; use a 10-minute rescue;
- multiple completed readings with zero attempts → stop treating consumption as evidence;
- overdue reviews with no completed retrieval → start with retrieval before new content;
- low independent-evaluator coverage → prefer questions with explicit guides;
- high calibration gap → use Examiner mode;
- observed practice → continue responding before looking at the guide.

When evidence is insufficient, SÓCRATES says so rather than fabricating a behavioral recommendation.

## Course coverage

`sds_weekly_course_evidence()` returns all seven enrolled courses, including zero-activity courses.

This prevents a common dashboard error: hiding neglected courses simply because they generated no events.

## Eight-week trace

`sds_weekly_learning_history()` exposes a rolling trace of evidence units and calibration signals.

The UI emphasizes trajectory rather than interpreting one unusually strong or weak week in isolation.

## Intervention outcome ledger

`sds_intervention_outcomes()` links a completed concept-targeted intervention to:

- nearest associated post-intervention attempt;
- previous attempt on the same concept;
- effective pre/post score;
- score source;
- observed delta.

This is explicitly labeled:

```text
Observational · not causal
```

A positive delta is not proof that the intervention caused improvement.

## Product gate

The outcome ledger exists to create evidence for future policy experiments.

No adaptive challenger should replace the transparent reinforcement rules until:
- there are enough paired outcomes;
- evaluator coverage is adequate;
- outcome definitions are stable;
- a prospective experiment can compare policies fairly.


## Exportable portfolio

The learner can export the selected weekly review as a Markdown portfolio file.

The export includes:
- week boundaries and timezone;
- evidence counts;
- evaluator coverage;
- calibration summary;
- visible learning debt;
- Stop / Start / Continue guidance;
- all-seven-course coverage;
- paired intervention outcome observations.

The export preserves the same product contract as the UI: it explicitly labels intervention deltas as observational rather than causal and does not present SÓCRATES scores as official academic grades.
