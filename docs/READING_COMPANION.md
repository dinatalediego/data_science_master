# SÓCRATES DS — Reading Companion

## Product principle

Reading is not completion. A source enters a four-step evidence loop:

```text
Preview → Active Reading → Explain Without Looking → Practice / Transfer
```

An unchecked step remains actionable and becomes the next visible trigger.

## Initial source-grounded pack

The first version is grounded in user-provided copies of:

- James D. Hamilton — *Time Series Analysis*
- Gilbert Strang — *Linear Algebra and Learning from Data*
- MIT 14.384 Lecture 1 — *Stationarity, Lag Operator, ARMA, and Covariance Structure*

The app stores bibliographic metadata, locators and original derivative study aids. It does not republish textbook pages.

## First-weeks routes

### Forecasting for Data Science

1. Dependence and stationarity — MIT 14.384 Lecture 1
2. Lag operators — Hamilton Chapter 2
3. Stationary ARMA processes — Hamilton Chapter 3
4. Forecasting — Hamilton Chapter 4

### Matemática para ML e IA

1. Matrix actions: Ax and AB — Strang Part I §§ I.1–I.2
2. Subspaces, elimination and orthogonality — §§ I.3–I.5
3. Eigenvalues, SVD and PCA — §§ I.6–I.9

### Other courses

The initial routes use the official MIT / Harvard / Stanford resources already curated in the Ivy+ Library. They are marked as official-resource mappings rather than textbook-grounded sections until the actual class syllabus/readings are uploaded.

## Checklist semantics

Each reading unit creates four user-owned tasks:

1. **Preview** — write questions before reading.
2. **Read** — identify definitions, assumptions and a difficult point.
3. **Explain** — close the source and reconstruct the idea.
4. **Practice** — solve, derive or apply.

Tasks unlock sequentially. The first unfinished unlocked task is the Reading Room's **Next Trigger**.

Completing a task writes a `reading_task_completed` LearningEvent. It does not automatically increase mastery.

## AI roadmap

V0.7 should add a private source-grounded tutor:

```text
Private source
   ↓
parse + chunk
   ↓
source locator / provenance
   ↓
retrieval
   ↓
artifact factory
   ├─ concise brief
   ├─ concept cards
   ├─ infographic spec
   ├─ derivation walkthrough
   ├─ practice set
   ├─ Socratic dialogue
   └─ adaptive checklist
   ↓
learner evidence
   ↓
next-best intervention
```

### Non-negotiables

- Never answer source-specific questions without retrieved evidence.
- Preserve page/chapter provenance.
- Do not copy long textbook passages into generated artifacts.
- Separate confidence from correctness.
- A checked reading does not equal mastery.
- Weak evidence should trigger targeted remediation, not another entire course.
- Every recommendation should say why it was selected.

## Adaptive trigger policy — target behavior

Examples:

- Preview incomplete → keep it as next action.
- Read complete, Explain incomplete → trigger closed-book explanation.
- Explain confidence high + weak performance → trigger misconception diagnostic.
- Practice weak → route to a smaller prerequisite unit.
- Unit complete → schedule T+1 / T+3 / T+7 retrieval.
- Repeated deferral → reduce scope to a 10–15 minute rescue mission.
