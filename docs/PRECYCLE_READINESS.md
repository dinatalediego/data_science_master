# SÓCRATES DS — Pre-Cycle Readiness V1.5

## Purpose

The period before Week 1 is not a race to consume the syllabus. It is a short launch window to remove avoidable friction and create the first trustworthy learning evidence.

Academic term:

- start: 2026-09-28
- end: 2027-01-30
- timezone: America/Lima

## Readiness contract

SÓCRATES does not infer readiness from:
- minutes watched;
- files opened;
- readings merely marked seen;
- calendar proximity.

The pre-cycle RPC reports observable signals for every enrolled course:

- concepts in the course;
- concepts with evidence;
- tutor attempts;
- available diagnostic questions;
- pending Reading Room tasks;
- source-grounded reading units;
- source-grounded pending actions;
- known schedule conflict.

## States

- **baseline_missing** — no tutor attempt exists yet.
- **attempt_without_concept_evidence** — an attempt exists, but no concept evidence was promoted.
- **early_evidence** — evidence exists, but coverage is still thin.
- **foundation_open** — baseline evidence exists and source-grounded foundation work remains.
- **evidence_started** — a useful baseline exists; Next-Best Action can take over.

None of these states is called “mastered” or “ready.”

## Bounded launch

The UI exposes at most three launch priorities at once.

Source-grounded Forecasting and Mathematics routes are surfaced first because the user already supplied Hamilton, Strang and MIT material. The remaining courses enter through a closed baseline diagnostic when curated questions are available.

This deliberately avoids turning the two pre-cycle weeks into a second full-time course load.

## Week-1 friction

The Monday overlap between Forecasting and ML Supervisado Advanced remains explicit. The Launchpad links to Calendar so attendance + catch-up can be decided before the first Monday.

## RPC

`sds_precycle_course_readiness()`

The function is authenticated and derives rows only from the current user's enrollment/evidence.

## Product rule

Once the academic term starts, the Launchpad disappears automatically and the normal Next-Best Action / Reinforcement loop becomes primary.
