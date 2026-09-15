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

## V1.1 — Reinforcement Engine

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

## V1.2 — AI Evidence Evaluator

Goal: stop using self-score as the only performance signal while preserving uncertainty and provenance.

- [x] owner-isolated attempt-evaluation store
- [x] authenticated evaluator API
- [x] evaluate only against explicit question + answer guide
- [x] non-official formative label
- [x] independent score + evaluator confidence
- [x] strengths, gaps, feedback and next prompt
- [x] fallback to self-score when evaluator confidence < 0.65
- [x] effective-score provenance: evaluator / mixed / self_score
- [x] Reinforcement Lab upgraded to confidence vs effective evidence
- [x] provider/model/version/latency audit
- [ ] real-attempt acceptance test after learner produces evidence
- [ ] production deployment after Vercel rate-limit reset

## V1.3 — Weekly Learning Review

Goal: turn the system into an observable learning PMO and measure what happens after interventions without claiming causality.

- [x] weekly evidence recap
- [x] intervention → later-outcome linkage
- [x] evaluator coverage
- [x] calibration trend
- [x] backlog / deferral trend
- [x] all-seven-course evidence coverage
- [x] “stop doing / start doing / continue” recommendations
- [x] eight-week evidence trace
- [x] exportable Markdown learning portfolio
- [x] observational / non-causal outcome labeling

## V1.4 — Intervention Effectiveness Memory

Goal: let learner-specific evidence compound cautiously across weeks.

- [x] intervention-type effectiveness profile
- [x] concept × intervention memory when sample exists
- [x] sample-size states: insufficient / emerging / observed
- [x] average observed delta and positive/stable/negative rates
- [x] evaluator-pair coverage
- [x] learner-facing Personal Learning Memory in Weekly Review
- [x] strict non-causal language
- [x] policy firewall: memory does not change action ranking
- [ ] prospective challenger experiment after sufficient paired outcomes
- [ ] production deployment after Vercel rate-limit reset

## V1.5 — Pre-Cycle Readiness Launchpad — current release

Goal: use the runway before 28 Sep to establish evidence and reduce Week-1 friction without overloading the learner.

- [x] seven-course readiness RPC
- [x] explicit baseline-missing state
- [x] concept evidence coverage
- [x] diagnostic-question availability
- [x] source-grounded reading availability
- [x] bounded top-3 launch priorities
- [x] Forecasting/Math source-grounded foundations surfaced first
- [x] Monday overlap surfaced before Week 1
- [x] Launchpad disappears automatically after the term starts
- [x] no readiness score from passive consumption
- [ ] production deployment after Vercel rate-limit reset

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
