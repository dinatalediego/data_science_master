-- SÓCRATES DS V1.4 — Intervention Effectiveness Memory
-- Descriptive learner memory only. Observational associations never alter policy ranking.

create or replace function public.sds_intervention_effectiveness_profile(
  p_days integer default 180
)
returns table (
  action_type text,
  paired_outcomes integer,
  avg_observed_delta numeric,
  positive_rate numeric,
  stable_rate numeric,
  negative_rate numeric,
  evaluator_pair_rate numeric,
  evidence_state text,
  interpretation text,
  last_observed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
with outcomes as (
  select *
  from public.sds_intervention_outcomes(
    greatest(30, least(coalesce(p_days,180),365))
  )
  where outcome_status='paired'
),
scored as (
  select
    action_type,
    count(*)::integer as paired_outcomes,
    round(avg(observed_delta)::numeric,3) as avg_observed_delta,
    round(
      count(*) filter (where observed_delta >= 0.10)::numeric / nullif(count(*),0),
      3
    ) as positive_rate,
    round(
      count(*) filter (where abs(observed_delta) < 0.10)::numeric / nullif(count(*),0),
      3
    ) as stable_rate,
    round(
      count(*) filter (where observed_delta <= -0.10)::numeric / nullif(count(*),0),
      3
    ) as negative_rate,
    round(
      count(*) filter (
        where pre_score_source in ('evaluator','mixed')
          and post_score_source in ('evaluator','mixed')
      )::numeric / nullif(count(*),0),
      3
    ) as evaluator_pair_rate,
    max(post_attempt_at) as last_observed_at
  from outcomes
  group by action_type
)
select
  action_type,
  paired_outcomes,
  avg_observed_delta,
  positive_rate,
  stable_rate,
  negative_rate,
  evaluator_pair_rate,
  case
    when paired_outcomes >= 5 then 'observed'
    when paired_outcomes >= 2 then 'emerging'
    else 'insufficient'
  end::text as evidence_state,
  case
    when paired_outcomes < 2
      then 'Muestra insuficiente: todavía no hay memoria útil para esta intervención.'
    when paired_outcomes < 5
      then 'Señal emergente: úsala como contexto descriptivo, no para cambiar la política.'
    when avg_observed_delta >= 0.10 and evaluator_pair_rate >= 0.50
      then 'Asociación positiva observada en evidencia posterior. No implica causalidad.'
    when avg_observed_delta <= -0.10
      then 'Asociación negativa observada. Revisar alcance, dificultad o timing antes de repetir.'
    else
      'Resultado observado mayormente estable. La evidencia no justifica preferir esta intervención.'
  end::text as interpretation,
  last_observed_at
from scored
order by
  case
    when paired_outcomes >= 5 then 0
    when paired_outcomes >= 2 then 1
    else 2
  end,
  paired_outcomes desc,
  avg_observed_delta desc nulls last;
$$;

grant execute on function public.sds_intervention_effectiveness_profile(integer) to authenticated;

create or replace function public.sds_intervention_effectiveness_by_concept(
  p_days integer default 180,
  p_min_pairs integer default 2
)
returns table (
  concept_id uuid,
  concept_title text,
  action_type text,
  paired_outcomes integer,
  avg_observed_delta numeric,
  positive_rate numeric,
  evidence_state text,
  last_observed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
with outcomes as (
  select *
  from public.sds_intervention_outcomes(
    greatest(30, least(coalesce(p_days,180),365))
  )
  where outcome_status='paired'
    and concept_id is not null
),
agg as (
  select
    concept_id,
    max(concept_title)::text as concept_title,
    action_type,
    count(*)::integer as paired_outcomes,
    round(avg(observed_delta)::numeric,3) as avg_observed_delta,
    round(
      count(*) filter (where observed_delta >= 0.10)::numeric / nullif(count(*),0),
      3
    ) as positive_rate,
    max(post_attempt_at) as last_observed_at
  from outcomes
  group by concept_id, action_type
)
select
  concept_id,
  concept_title,
  action_type,
  paired_outcomes,
  avg_observed_delta,
  positive_rate,
  case
    when paired_outcomes >= 5 then 'observed'
    when paired_outcomes >= greatest(2, least(coalesce(p_min_pairs,2),5)) then 'emerging'
    else 'insufficient'
  end::text as evidence_state,
  last_observed_at
from agg
where paired_outcomes >= greatest(1, least(coalesce(p_min_pairs,2),5))
order by paired_outcomes desc, avg_observed_delta desc nulls last;
$$;

grant execute on function public.sds_intervention_effectiveness_by_concept(integer,integer) to authenticated;
