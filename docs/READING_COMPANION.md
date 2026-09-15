# SÓCRATES DS — Reading Companion

## Product principle

Reading is not completion. Every important source enters a four-step evidence loop:

```text
Preview → Active Reading → Explain Without Looking → Practice / Transfer
```

An unchecked step remains actionable and becomes the next visible trigger. Completing the final practice step schedules spaced retrieval; it does **not** promote mastery automatically.

## V0.7 implemented core

The Reading Companion now includes:

- source-aware reading units and explicit locators;
- concise source chunks for retrieval;
- reading-unit → concept mappings;
- evidence-required checklist completion;
- confidence captured separately from completion;
- automatic T+1 / T+3 / T+7 / T+21 review scheduling;
- Campus-level next-reading trigger;
- an interactive SÓCRATES AI coach;
- AI interaction audit with source locators;
- deterministic evidence-only fallback when AI generation is unavailable.

### AI modes

- Explain
- Socratic
- Examiner / quiz
- Derivation
- Apply / transfer
- One-page summary
- Concept cards
- Infographic specification
- Adaptive checklist

The server contract requires source-specific claims to use retrieved evidence. If retrieval is insufficient, the tutor must say so instead of filling the gap with general model knowledge.

## Initial source-grounded pack

The first deep pack is grounded in user-provided copies of:

- James D. Hamilton — *Time Series Analysis*
- Gilbert Strang — *Linear Algebra and Learning from Data*
- MIT 14.384 Lecture 1 — *Stationarity, Lag Operator, ARMA, and Covariance Structure*

SÓCRATES stores bibliographic metadata, locators and concise derivative study aids. It does not republish textbook pages or long passages.

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

Their first routes use official MIT / Harvard / Stanford resources from the Ivy+ Library. These remain labeled as official-resource mappings rather than textbook-grounded sections until their actual class syllabus/readings are available.

## Checklist semantics

Each reading unit starts with four user-owned actions:

1. **Preview** — formulate questions before reading.
2. **Read** — identify definitions, assumptions and a difficult point.
3. **Explain** — reconstruct the idea with the source closed.
4. **Practice** — solve, derive or apply.

Actions unlock sequentially. Completing an action requires a short evidence note and a confidence estimate. The first unfinished unlocked action becomes the visible **Next Trigger**.

When the final practice action is completed, SÓCRATES schedules retrieval for mapped prerequisite/core concepts at T+1, T+3, T+7 and T+21.

## Grounding architecture

```text
Reading source
   ↓
bounded source notes + locator
   ↓
retrieval for selected unit
   ↓
SÓCRATES AI
   ├─ explanation
   ├─ Socratic question
   ├─ quiz
   ├─ derivation
   ├─ transfer
   └─ generated study artifact
   ↓
source locators shown to learner
   ↓
interaction audit
```

### Non-negotiables

- Never answer source-specific questions without retrieved evidence.
- Preserve page/chapter provenance.
- Do not copy long textbook passages into generated artifacts.
- Separate confidence from correctness.
- A checked reading does not equal mastery.
- Weak evidence should trigger targeted remediation, not another entire course.
- Every recommendation should be explainable.

## Next frontier — V0.8

The next major increment is private ingestion of new user-provided syllabi, papers, slides and books with page-aware parsing/chunking. That will let every new course reading enter the same grounded workflow without hand-authored seed data.
