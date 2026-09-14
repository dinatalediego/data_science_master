# Architecture — SÓCRATES DS V0.1

## Purpose

SÓCRATES DS is a personal learning operating system. Its architecture optimizes for evidence of learning, not storage volume or content consumption.

## System context

~~~text
                    ┌─────────────────────────────┐
                    │        SÓCRATES DS          │
                    │   Personal Learning OS      │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
     Campus Web               Tutor Runtime           Learning Analytics
 Next.js / Vercel            SÓCRATES modes          SQL + Python views
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                               Supabase
                    Auth + Postgres + Storage
                                   │
             ┌─────────────────────┼─────────────────────┐
             │                     │                     │
        Domain data          Learning events       Future RAG index
             │                     │                     │
             └─────────────────────┼─────────────────────┘
                                   │
                                GitHub
                    notebooks / labs / thesis / CI
~~~

## Architectural boundaries

### 1. Experience layer

- Campus Home
- Course Workspace
- SÓCRATES tutor
- Mastery map
- Calendar
- Labs
- Thesis workspace

The UI should explain why a task is recommended. It must not hide scheduling conflicts, uncertainty or missing evidence.

### 2. Learning domain layer

The core objects are Course, Session, Concept, Assessment, Attempt, MasteryState, Misconception, ReviewItem, Lab, Artifact and LearningEvent.

Concept is the primary unit of learning. Files and resources support concepts; they are not themselves progress.

### 3. Persistence layer

Supabase PostgreSQL is the source of truth for academic and learning state. Authentication owns user identity. Row-level security isolates user-specific learning data.

### 4. Evidence and analytics layer

LearningEvent is append-only telemetry. Derived mastery should be explainable from attempts, reviews and artifacts. No score should exist without traceable evidence.

### 5. Integration layer

Planned integrations:

- Google Calendar for class and review scheduling
- GitHub for notebooks, labs, versioned artifacts and CI
- optional document ingestion for course material
- optional embedding index for retrieval-augmented tutoring

## Data flow

~~~text
Class / material / problem
          ↓
      Concept links
          ↓
Learning session / assessment
          ↓
       Attempt
          ↓
Evidence + confidence + feedback
          ↓
 MasteryState / Misconception
          ↓
Review queue + next-best action
          ↓
       Campus Home
~~~

## Mastery dimensions

Every concept may be scored independently on:

- conceptual
- mathematical
- coding
- transfer
- retention
- confidence

Calibration gap is derived from confidence minus observed performance; it should not be stored as an unexplained magic score.

## Scheduling principle

Calendar automation should create a learning envelope around a class:

~~~text
T-24h  diagnostic / prerequisites
T0     class
T+1d   active recall
T+3d   retrieval
T+7d   retrieval + transfer
T+21d  retention check
~~~

Exact scheduling remains configurable and should respect real calendar conflicts.

## Security

- No service-role key in the browser.
- All user-specific tables use RLS.
- Secrets live only in environment variables.
- SQL migrations are version controlled.
- Destructive production migrations require explicit review.

## V0.1 non-goals

- autonomous grading of high-stakes academic work
- automatic calendar writes
- production RAG
- multi-tenant institution management
- opaque AI-generated mastery scores

## Next architecture increment

V0.2 adds the deployable Next.js application, Supabase client/server boundaries, authentication, typed queries and the first Today dashboard.
