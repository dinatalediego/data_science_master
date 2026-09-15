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

## V0.7 — AI Reading Companion — current release

Goal: turn readings into adaptive evidence loops.

- [x] source-grounded Hamilton / Strang / MIT 14.384 pack
- [x] reading-unit → concept mappings
- [x] evidence-required checklist actions
- [x] confidence captured separately
- [x] first incomplete action becomes a Campus trigger
- [x] T+1 / T+3 / T+7 / T+21 review scheduling
- [x] source retrieval with locators
- [x] AI modes: explain, Socratic, quiz, derive, apply, summary, cards, infographic spec, checklist
- [x] AI interaction audit
- [x] evidence-only fallback if live AI is unavailable
- [x] CI safeguards for grounding contract
- [ ] production deployment + smoke test

## V0.8 — Private ingestion

Goal: make new course material self-service while preserving provenance.

- private upload workflow for syllabi, books, papers and slides
- page-aware parsing and chunking
- source/version registry
- reading-unit proposal from syllabus/week structure
- automatic artifact drafts with human approval
- source coverage and retrieval-quality tests

## V0.9 — Adaptive learning engine

Goal: choose smaller, more effective interventions.

- misconception diagnostics from answer evidence
- prerequisite rescue missions
- confidence × performance calibration
- adaptive difficulty
- repeated-deferral detection
- 10–15 minute rescue missions
- retrieval scheduling tuned from observed performance

## V1.0 — Learning OS

Goal: one coherent operating system for the seven courses and thesis.

- class → reading → retrieval → practice → transfer cycle
- cross-course concept graph
- thesis as transfer layer
- measurable weekly learning review
- auditable next-best learning action
- reproducible learning portfolio

## Product gate

Do not optimize for more AI output. Optimize for better evidence of learning. Transparent rules remain the default; automation earns scope only after observed usefulness.
