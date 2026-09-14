# Domain Model

## Design rule

The domain is organized around concepts and evidence. Completion is metadata; mastery is a claim that must be supported.

## Core entities

### Course
Academic container for concepts, sessions, resources, assessments and labs.

### CourseSession
A scheduled or completed class meeting. It can record attendance state, capture notes and trigger post-class learning actions.

### Concept
A learnable unit such as gradient descent, stationarity, PCA or calibration.

Important fields:
- title and description
- course ownership
- difficulty
- tags
- optional canonical key for cross-course reuse

### ConceptDependency
Directed prerequisite edge: prerequisite_concept → dependent_concept.

This graph lets the tutor diagnose backward. A failed PCA task may lead to an eigenvectors gap rather than another PCA explanation.

### Resource
A paper, slide deck, note, video, notebook or external reference. Resources must link to at least one learning purpose before being treated as useful.

### LearningSession
A bounded study interaction with a mode such as socratic, feynman, practice, exam, lab or review.

### Assessment / Question
A structured evaluation instrument. Questions may target one or more concepts and dimensions.

### Attempt
Evidence produced by answering a question or solving a task. Stores outcome, confidence, response metadata and feedback.

### MasteryState
Current explainable estimate for a learner × concept. It contains multiple dimensions instead of one universal percentage.

### Misconception
A first-class record of a wrong mental model, confusion or recurring reasoning error. It can be open, improving or resolved.

### ReviewItem
Spaced-repetition queue item with due date, interval and reason.

### Lab
A practical exercise or notebook with expected evidence.

### Artifact
A produced output: notebook, report, model card, derivation, explanation, thesis section or presentation.

### LearningEvent
Append-only telemetry describing important learning actions. It enables later analytics without rewriting history.

## Learning evidence ladder

~~~text
seen → recalled → explained → solved → applied → transferred → mastered
~~~

The ladder is ordinal evidence, not a guarantee of permanence. Retention can decay and trigger review without deleting historical achievements.

## Mastery dimensions

| Dimension | Evidence example |
|---|---|
| conceptual | explains the idea and distinguishes nearby concepts |
| mathematical | derives or manipulates the relevant mathematics |
| coding | implements or debugs correctly |
| transfer | solves a novel problem without template copying |
| retention | succeeds after a meaningful delay |
| confidence | self-estimated probability of being correct |

## Suggested state transitions

### Misconception
~~~text
open → improving → resolved
           ↘
          reopened
~~~

### Review item
~~~text
due → completed → scheduled
  ↘
 skipped / overdue
~~~

### Course session attendance
~~~text
scheduled → attended
          → missed → catch_up_planned → caught_up
          → partial
~~~

## Invariants

1. A concept dependency cannot point to itself.
2. A mastery state is unique per user and concept.
3. Attempts are never overwritten to fabricate improvement; new attempts create new evidence.
4. Learning events are append-only.
5. Unknown academic metadata remains NULL rather than guessed.
6. The thesis may consume concepts from every course.
7. Confidence and performance remain separate so calibration can be measured.

## Initial aggregate boundaries

- Course aggregate: course, sessions, concepts, resources, assessments, labs.
- Learner aggregate: learning sessions, attempts, mastery, misconceptions, review queue.
- Evidence aggregate: attempts, artifacts and learning events.

These boundaries are intentionally lightweight in V0.1 and can evolve when the application exposes real usage patterns.
