# SÓCRATES DS — Personal Learning Campus

> **V0.1 — Foundation**
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

## V0.1 definition of done

V0.1 is a **foundation release**, not yet the production web app.

- [x] Product and learning philosophy defined
- [x] Seven courses represented canonically
- [x] Domain model defined
- [x] Campus UX specified
- [x] Supabase schema versioned
- [x] Seed data versioned
- [x] Repository validation automated
- [ ] Supabase project provisioned and migration applied
- [ ] Next.js Campus shell implemented
- [ ] Vercel deployment connected
- [ ] Authentication enabled
- [ ] Google Calendar synchronization implemented
- [ ] SÓCRATES tutoring runtime implemented

## Next milestone

**V0.2 — First deployable Campus**

Build the authenticated Next.js shell, connect Supabase, render the seven courses and academic calendar, show the Monday schedule conflict, and create the first “Today” learning dashboard.

---

**SÓCRATES DS**  
*Do not optimize for consuming more. Optimize for understanding more, remembering longer and transferring farther.*
