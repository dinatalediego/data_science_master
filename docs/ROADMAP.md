# Roadmap

## Shipped foundation

### V0.1 — Foundation
Canonical seven-course catalog, architecture, domain model, learning constitution, Supabase foundation and repository validation.

### V0.2 — Campus
Authenticated Next.js product, Campus Home, courses, academic schedule, Vercel production and Supabase data access.

### V0.3 — Evidence loop
Learning sessions, attempts, confidence, mastery dimensions, misconceptions, spaced review queue and append-first learning events.

### V0.4 — Experience + tutor baseline
Museum/library visual direction, SÓCRATES practice modes, source-aware UI and stronger learning-state UX.

### V0.5 — Authentication
Google Sign-In as preferred path; email/password retained as backup.

### V0.6 — Ivy+ Library + Reading Room
MIT/Harvard/Stanford curation, first-weeks reading routes, persistent checklists and source-derived study artifacts.

### V0.7 — AI Reading Companion
Source-grounded Hamilton / Strang / MIT 14.384 routes, AI Reading Coach, evidence-required checklists and spaced retrieval.

### V0.8 — Private ingestion
Private PDF upload, page-aware parsing/chunking, owner-isolated storage, reading-unit proposals and provenance.

### V0.9 — Persistent Study Packs
Persistent AI-generated carta, summary, concept cards, infographic spec, practice and checklist with provenance.

### V1.0 — Learning OS
Transparent Next-Best Learning Action queue, top-3 recommendations, audit events, academic-term runtime and the seven-course Campus.

## V1.1 — Reinforcement Engine — current release

Goal: detect where learning is breaking and recommend the smallest useful intervention.

- [x] persisted action snooze/deferral state
- [x] 24-hour snooze from recommendations
- [x] repeated-deferral detection
- [x] 10-minute rescue intervention
- [x] confidence vs self-score calibration profile
- [x] overconfidence / underconfidence diagnostics
- [x] prerequisite rescue from concept-dependency graph
- [x] learner-facing Reinforcement Lab
- [x] targeted deep links from next-best action → Reading Room / SÓCRATES
- [x] targeted action completion audit
- [x] deterministic priority rules before ML
- [x] RLS-isolated action state
- [ ] production deployment + authenticated smoke test

## V1.2 — Outcome-calibrated adaptation

Goal: stop using self-score as the only performance signal.

- rubric/AI-assisted grading with explicit uncertainty
- human override / review path
- compare confidence against externally scored performance
- measure intervention uplift on later recall and transfer
- challenger policy vs deterministic V1.1 baseline
- promote challenger only with measurable improvement
- preserve decision provenance and rollback

## V1.3 — Weekly Learning Review

Goal: turn the system into an observable learning PMO.

- weekly evidence recap
- retention trend
- calibration trend
- backlog / deferral trend
- course coverage vs academic week
- thesis transfer evidence
- “stop doing / start doing / continue” recommendations
- exportable learning portfolio

## V2.0 — Personal Learning Intelligence

Goal: a durable learner model that compounds across courses.

- cross-course concept graph
- intervention effectiveness memory
- personal forgetting curves
- source preference / modality evidence
- skill transfer graph
- thesis and professional-project transfer
- model-assisted recommendations constrained by transparent policy gates

## Product gate

Do not optimize for more AI output. Optimize for stronger later evidence.

Transparent rules remain the default. Any adaptive or ML challenger must beat the deterministic baseline on retention, transfer or calibration before promotion.
