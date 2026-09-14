# Campus Specification — V0.1

## Product promise

Open the Campus and understand within 30 seconds:

1. What is happening academically?
2. What am I forgetting?
3. What is blocking deeper understanding?
4. What is the highest-value action I can do next?

## Information architecture

### / — Campus Home

Primary cards:

- Next class
- Today's recommended study plan
- Due reviews
- Weakest prerequisites
- Upcoming assessments
- Schedule conflicts
- Weekly retention
- Open misconceptions

Example recommendation:

> Review partial derivatives for 20 minutes before studying gradient descent. Your conceptual score is stronger than your mathematical evidence, and the prerequisite has two overdue reviews.

### /courses

Seven course cards with:

- next session
- current module
- mastery coverage
- due reviews
- open assignments
- unresolved misconceptions

### /courses/[slug]

Tabs:

- Overview
- Syllabus
- Classes
- Concepts
- Notes
- Resources
- Labs
- Assignments
- Practice
- Exams
- Mastery

### /socrates

Session setup:

- select course / concepts
- select mode
- select available time
- optional target such as prepare, understand, practice, exam or debug

Session end:

- evidence produced
- misconceptions found
- confidence calibration
- recommended follow-up
- review items created

### /mastery

Views:

- concept graph
- course heatmap
- dimensions per concept
- confidence vs observed performance
- retention risk
- prerequisite bottlenecks

### /calendar

Views:

- academic week
- class schedule
- learning-envelope tasks
- conflicts

V0.1 must explicitly show the Monday overlap between Forecasting (18:00–21:00) and ML Supervisado Advanced (19:00–22:00).

### /labs

Track notebooks and practical work by course, concept, status and evidence.

### /thesis

Research workspace that links thesis decisions to concepts learned elsewhere.

## Today recommendation algorithm — initial heuristic

Until enough behavioral data exists, use transparent rules rather than ML:

~~~text
priority =
  overdue_review_weight
+ upcoming_class_prerequisite_weight
+ misconception_severity_weight
+ assessment_urgency_weight
+ transfer_gap_weight
- cognitive_load_penalty
~~~

The UI must show the reason behind the recommendation.

## States

### Empty state
Explain what evidence is missing and offer one concrete action.

### Conflict state
Never auto-resolve a class conflict. Ask the learner to choose attendance strategy and create a catch-up plan.

### Low-evidence state
Use language such as “insufficient evidence” rather than inventing precision.

## UX principles

- calm academic visual language
- high information density without dashboard clutter
- keyboard-friendly
- mobile usable for capture and review
- accessible contrast and semantic headings
- no gamification that rewards shallow clicks
- every metric has an explanation

## V0.2 acceptance criteria

- authenticated user can see all seven canonical courses
- Campus shows the next scheduled course from canonical data
- Monday conflict is visible
- user can open a course workspace
- user can record a learning session
- user can record confidence and result for an attempt
- mastery page can render real stored evidence
- app can deploy successfully on Vercel
- Supabase RLS prevents cross-user data access
