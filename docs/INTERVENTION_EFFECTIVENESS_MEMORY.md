# SÓCRATES DS — Intervention Effectiveness Memory V1.4

## Purpose

SÓCRATES should learn from the learner's history, but it must not confuse an observed before/after association with causal evidence.

V1.4 introduces a descriptive memory layer over the intervention outcome ledger.

## What is remembered

For each intervention type, the system can summarize:

- number of paired pre/post outcomes;
- average observed score delta;
- positive outcome rate;
- stable outcome rate;
- negative outcome rate;
- share of pairs where both scores have evaluator-backed provenance;
- most recent observed later evidence.

A second RPC exposes concept × intervention summaries when at least two paired outcomes exist.

## Evidence states

The UI and RPC use explicit sample-size gates:

| State | Paired outcomes | Meaning |
|---|---:|---|
| insufficient | 0–1 | do not interpret |
| emerging | 2–4 | descriptive context only |
| observed | 5+ | enough history to describe a recurring association, still not causal |

Even at `observed`, the system uses wording such as **“positive association observed”**, never “this intervention caused improvement.”

## Policy firewall

V1.4 does **not** modify `sds_next_best_learning_actions()`.

The transparent deterministic policy remains production control. Intervention memory is read-only context until a future experiment can compare:

```text
deterministic baseline
        vs
memory-informed challenger
```

on later retention, transfer and calibration.

## Promotion gate

A memory-informed challenger should not be promoted unless:

1. an intervention type has at least five paired outcomes;
2. evaluator-backed score coverage is adequate;
3. score provenance is stable;
4. the outcome definition is fixed before testing;
5. a prospective experiment shows improvement over the deterministic baseline.

## Sparse-data behavior

An empty profile is a valid product state.

The learner sees that SÓCRATES is **waiting for real evidence**, rather than fabricating personalization from one interaction.

## RPCs

- `sds_intervention_effectiveness_profile(p_days)`
- `sds_intervention_effectiveness_by_concept(p_days, p_min_pairs)`

Both functions are owner-scoped through `auth.uid()` via the underlying outcome ledger.

## UI

The Weekly Learning Review includes **Personal Learning Memory**:

- intervention type;
- sample size;
- observed delta;
- positive rate;
- evidence state;
- interpretation;
- concept-specific emerging signals when enough paired data exists.

This is the first deliberately conservative step toward Personal Learning Intelligence.
