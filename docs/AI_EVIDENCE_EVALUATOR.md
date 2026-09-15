# SÓCRATES DS — AI Evidence Evaluator V1.2

## Purpose

V1.2 separates three different signals that must not be conflated:

1. **Confidence** — how likely the learner believes their answer is correct.
2. **Self-score** — the learner's own judgment after producing the answer.
3. **Independent formative evaluation** — a non-official AI contrast against the explicit answer guide.

The evaluator never overwrites the learner response or self-score.

## Evaluation contract

The evaluator receives only:
- the question;
- the question dimension and difficulty;
- the explicit answer guide;
- the learner response;
- learner confidence and self-score as context.

It is instructed to judge the answer **only against the supplied guide** and not invent extra grading criteria.

The structured output includes:
- score, 0–1, or null if evidence is insufficient;
- evaluator confidence, 0–1;
- verdict: strong / partial / weak / insufficient;
- demonstrated strengths;
- missing or imprecise elements;
- formative feedback;
- a targeted next prompt;
- rubric metadata;
- provider/model/latency.

## Non-official status

This is formative evidence, not an academic grade.

The UI labels the result:

```text
AI EVIDENCE CONTRAST · NO OFFICIAL GRADE
```

The answer guide remains visible as the explicit reference criterion.

## Calibration policy

`sds_attempt_effective_scores()` decides which performance signal may enter calibration:

```text
completed evaluator
+ score exists
+ evaluator confidence >= 0.65
              │
              ▼
     use evaluator score
```

Otherwise:

```text
use learner self-score
and expose source = self_score
```

No low-confidence AI score can silently change the calibration profile.

`sds_calibration_profile_v2()` exposes:
- attempts;
- evaluated attempts;
- average confidence;
- average self-score;
- average effective performance;
- confidence − performance gap;
- calibration state;
- score source: evaluator / mixed / self_score.

## Failure behavior

If the answer guide is missing:
- evaluation status = insufficient;
- score = null;
- calibration falls back to self-score.

If the AI provider is unavailable:
- evaluation status = unavailable;
- no synthetic heuristic score is invented;
- the original attempt remains valid;
- calibration falls back to self-score.

## Data model

`sds_attempt_evaluations` is append/version oriented:
- one attempt can have multiple evaluation versions;
- the latest version is used for effective score selection;
- learner ownership is protected with RLS;
- provider/model metadata preserves provenance.

## Current limitation

The evaluator runs through an authenticated server route, but this personal-product release still uses the learner's Supabase session to persist the evaluation under owner RLS. Future multi-user hardening should make evaluator writes service-only so the independent signal is also tamper-resistant.

## Next evidence gate

Do not promote evaluator-backed calibration as superior until real tutor attempts exist and we can observe:
- evaluation coverage;
- evaluator confidence distribution;
- disagreement with self-score;
- later retrieval performance;
- whether targeted feedback improves the next attempt.
