# SÓCRATES DS V1.0 — Next-Best Learning Action Engine

## North Star

The Campus does not optimize for content consumption. It chooses the smallest action that is most likely to produce useful learning evidence now.

## Transparent priority contract

The engine is deterministic SQL before any ML:

1. **Overdue spaced retrieval**
2. **Open misconception**
3. **First unlocked incomplete Reading Mission action**
4. **Weakest evidence-backed concept**
5. **Baseline evidence creation**

Each candidate exposes:

- priority score;
- action type;
- title and body;
- explicit reason;
- destination;
- estimated minutes;
- source course or concept when relevant.

This lets the learner inspect why SÓCRATES recommends something instead of receiving an opaque AI score.

## Priority semantics

### Retrieval

Score starts at 100 and increases with overdue days, capped at a bounded urgency bonus.

Reasoning: once retrieval is due, testing retention has higher value than consuming more material.

### Misconception

Score starts near 90 and scales with recorded severity.

Reasoning: practicing on top of a wrong representation can reinforce the error.

### Reading

Score starts near 70 and receives small bonuses for:
- source-grounded routes;
- higher template priority;
- evidence-producing actions such as Explain / Solve / Apply.

Only the first unlocked unfinished route per course enters the top queue, preventing one course from flooding the dashboard.

### Weak mastery

Only concepts with real evidence are eligible. Missing evidence is never treated as low mastery.

### Baseline

Used when no evidence-backed mastery exists.

## Observability

Opening a recommendation writes an event to:

`sds_learning_action_events`

The event includes action type, referenced entity, priority, reason and contextual metadata.

This gives future adaptive models a reproducible baseline:

```text
rule recommendation
      ↓
opened?
      ↓
completed?
      ↓
later learning evidence
      ↓
was the recommendation useful?
```

## Guardrails

- A recommendation never changes mastery.
- Reading completion never implies mastery.
- Confidence is separate from correctness.
- The engine ranks states already supported by evidence and explicit learning rules.
- ML may later challenge this baseline, but it must demonstrate better learner outcomes before replacing it.
