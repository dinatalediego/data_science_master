# SÓCRATES DS — Personal Learning Campus

> **V1.6 — Evidence-First Academic Learning OS**
>
> A personal learning operating system for mastering a Data Science graduate program through evidence, retrieval, deliberate practice, transfer, and reflection — not passive content consumption.

## North Star

SÓCRATES DS exists to answer one question every day:

> **What should I study next, and what evidence proves that I actually learned it?**

The system treats learning as an observable cycle:

~~~text
Prepare → Understand → Recall → Explain → Solve → Apply → Transfer → Retain
                                               ↓
                                         Mastery evidence
                                               ↓
                                      Next-best learning action
~~~

A PDF is not progress. A watched class is not mastery. A concept becomes stronger only when there is evidence that it can be recalled, explained, solved, applied and transferred.

## The 7 courses

| Course | Day | Time | Role in the system |
|---|---|---:|---|
| Forecasting for Data Science | Monday | 18:00–21:00 | Time, uncertainty, backtesting and temporal decisions |
| Machine Learning Supervisado Advanced | Monday | 19:00–22:00 | Advanced supervised models, tuning, calibration and interpretation |
| Electivo 2 — Ciberseguridad de IA | Tuesday | 19:00–22:00 | Security, privacy, model risk and responsible AI |
| Matemática para ML e IA | Wednesday | 19:00–22:00 | Mathematical foundations for ML and optimization |
| Machine Learning Supervisado Fundamentals | Thursday | 19:00–22:00 | Core supervised learning, evaluation and generalization |
| Machine Learning No Supervisado | Saturday | 10:00–13:00 | Structure, representation, clustering and dimensionality reduction |
| Proyecto Integrador — Desarrollo del Plan de Tesis | Saturday | 14:00–17:00 | Integration, research design and evidence production |

> Note: the Monday overlap between Forecasting and ML Supervisado Advanced is intentionally modeled as a schedule conflict to be managed by the Campus instead of hidden.

Canonical metadata lives in config/courses.json.

## Product surfaces

### Campus
Daily command center: next class, review queue, weak concepts, study load, schedule conflicts and the recommended next action.

### Course Workspace
Each course has syllabus, classes, concepts, notes, resources, labs, assignments, practice, exams and mastery evidence.

### SÓCRATES
Adaptive tutor with explicit modes:

- **Socratic** — ask before telling.
- **Professor** — intuition → math → code → application.
- **Feynman** — evaluate the learner's own explanation.
- **Examiner** — assess without helping.
- **Coach** — decide the next-best learning action.
- **Debugger** — inspect code, notebooks and reasoning errors.
- **Researcher** — connect concepts to papers and evidence.
- **Thesis Advisor** — transfer learning into the research project.
- **Devil's Advocate** — challenge assumptions and conclusions.

### Mastery
The system separates completion from competence. Mastery is tracked across:

- conceptual understanding
- mathematical understanding
- coding ability
- transfer to a novel problem
- retention over time
- calibration between confidence and actual performance

### Labs
Notebooks, exercises, experiments and reproducible artifacts.

### Thesis
The capstone layer that forces transfer across the other six courses.


### WhatsApp Tutor

Scheduled SÓCRATES DS practice by WhatsApp. It varies short applied questions across the seven courses, accepts text replies, evaluates against each question's explicit answer guide, and saves reliable evidence to the existing learning-memory tables. The learner controls one, two or three daily passes and can pause with PAUSAR.

The WhatsApp Cloud API setup, approved template, webhook and server variables are documented in [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md). Scheduled sends require a Meta Business number and an approved WhatsApp template; secure provider credentials are configured outside the repository.

## Learning evidence ladder

~~~text
SEEN
  ↓
RECALLED
  ↓
EXPLAINED
  ↓
SOLVED
  ↓
APPLIED
  ↓
TRANSFERRED
  ↓
MASTERED
~~~

A learner can move forward only with evidence. Time spent is useful telemetry, but never sufficient proof.

## Repository structure

~~~text
data_science_master/
├── README.md
├── ARCHITECTURE.md
├── config/
│   └── courses.json
├── docs/
│   ├── CAMPUS_SPEC.md
│   ├── DOMAIN_MODEL.md
│   ├── LEARNING_CONSTITUTION.md
│   └── ROADMAP.md
├── scripts/
│   └── validate_repo.py
├── supabase/
│   ├── migrations/
│   │   └── 0001_socrates_foundation.sql
│   └── seed.sql
└── .github/
    └── workflows/
        └── validate.yml
~~~

The application layer will be introduced in the next phase as a Next.js + TypeScript + Tailwind frontend deployable to Vercel.

## Architecture principles

1. **Concept-first, not file-first.**
2. **Evidence over self-reported progress.**
3. **Retrieval before re-reading.**
4. **Prediction before execution.**
5. **Transfer before mastery.**
6. **Misconceptions are first-class data.**
7. **Confidence must be calibrated against performance.**
8. **The thesis is an integration layer, not an isolated course.**
9. **Every resource must lead to a cognitive action.**
10. **The system recommends less when less is better.**

See ARCHITECTURE.md and docs/LEARNING_CONSTITUTION.md.

## Initial data model

The Supabase foundation includes:

- courses and enrollments
- scheduled course sessions
- concepts and prerequisite edges
- resources
- learning sessions
- assessments, questions and attempts
- mastery states
- misconceptions
- spaced-review queue
- labs and artifacts
- append-only learning events

The initial migration is in supabase/migrations/0001_socrates_foundation.sql.

## Live product status

**Canonical production:** https://socrates-ds.vercel.app  
**Canonical Vercel project:** `socrates-ds`

The duplicate Vercel project named `data_science_master` is intentionally not used as production. All release verification and deployment decisions target only `socrates-ds`.

The current product is live on Vercel and connected to the shared Supabase project through an isolated `sds_` namespace. It also includes a curated Ivy+ Learning Library that links official MIT, Harvard and Stanford sources without mirroring copyrighted course content. The live foundation contains the seven-course program, an Ivy+ Library, persistent Reading Room missions and a source-grounded AI Reading Companion.

Implemented product surfaces:

- Supabase email/password authentication
- Campus Home with transparent next-best-action heuristic
- seven course workspaces
- Ivy+ Learning Library with official MIT, Harvard and Stanford resources mapped to courses and concepts
- Reading Room with source-grounded first-weeks routes, persistent evidence checklists and next-action triggers
- AI Reading Coach with explanation, Socratic, quiz, derivation, transfer and artifact-generation modes
- automatic T+1/T+3/T+7/T+21 retrieval scheduling after completed reading missions
- private PDF ingestion with page-aware provenance and owner-isolated storage
- persistent AI Study Packs: carta, resumen, concept cards, mapa/infografía, práctica y checklist
- transparent Next-Best Learning Action queue driven by retrieval due dates, misconceptions, unfinished readings and evidence-backed weaknesses
- Reinforcement Engine with 24h snooze, repeated-deferral detection, 10-minute rescue missions, calibration diagnostics and prerequisite rescue
- AI Evidence Evaluator that contrasts tutor responses only against explicit answer guides, preserves uncertainty, and falls back transparently to self-score
- Weekly Learning Review with Stop/Start/Continue, eight-week evidence trajectory and exportable Markdown portfolio
- Personal Learning Memory that summarizes observed intervention outcomes with explicit sample-size and non-causal gates
- Pre-Cycle Readiness Launchpad that uses the runway before Week 1 for bounded baselines, source-grounded foundations and schedule-risk preparation
- Academic Week Intelligence with selectable S01–S18 timeline, exact dated sessions and real-date overlap visibility
- mastery evidence view
- academic weekly calendar and explicit Monday conflict
- thesis transfer workspace
- SÓCRATES practice modes: Socratic, Feynman and Examiner
- evidence writes: sessions, attempts, confidence, mastery summaries, misconceptions, review queue and append-first learning events
- responsive desktop/mobile UI
- GitHub Actions repository validation and production build

Calendar integration is intentionally conservative: the connected Google Calendar was checked read-only during setup and no academic events matching the seven course names were found. The deployed application therefore uses its canonical academic schedule and does not write Google Calendar events automatically. Full in-app Google OAuth sync remains a separate integration step because it requires application OAuth credentials.

## V0.1 definition of done

V0.1 is a **foundation release**, not yet the production web app.

- [x] Product and learning philosophy defined
- [x] Seven courses represented canonically
- [x] Domain model defined
- [x] Campus UX specified
- [x] Supabase schema versioned
- [x] Seed data versioned
- [x] Repository validation automated
- [x] Supabase backend selected, namespaced migration applied and seed validated
- [x] Next.js Campus shell implemented
- [x] Vercel production deployment live
- [x] Authentication enabled
- [~] Google Calendar read-only setup check completed; runtime OAuth sync pending app credentials
- [x] SÓCRATES evidence-driven tutoring baseline implemented

## Next milestone

**V2.0 — Personal Learning Intelligence**

Continue building a durable learner model: forgetting curves, modality/source effectiveness, cross-course transfer and a prospective challenger policy. No adaptive policy is promoted until it beats the transparent baseline on later evidence.

---

**SÓCRATES DS**  
*Do not optimize for consuming more. Optimize for understanding more, remembering longer and transferring farther.*
