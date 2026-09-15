# SÓCRATES DS — Academic Week Intelligence V1.6

The 18-week academic strip is now operational rather than decorative.

## Canonical source

Dates are derived from:

- `config/courses.json → academic_term.nominal_start = 2026-09-28`
- 18 weeks
- each course's canonical `day_of_week`, `start_time` and `end_time`

No duplicate dated-session table is introduced.

## Behavior

The learner can select S01–S18. For the selected week SÓCRATES derives the exact dated agenda, sorts sessions chronologically and flags real schedule overlaps.

Before the term, Week 1 is selected by default. During the term, the current academic week is selected.

## Contract

- Week 1 begins Monday 28 Sep 2026.
- No session is generated after 30 Jan 2027.
- The Forecasting / ML Advanced Monday overlap remains visible on the actual date.
- Week selection uses real buttons with `aria-pressed` and focus-visible states.
- Academic-term configuration remains the single source of truth.
