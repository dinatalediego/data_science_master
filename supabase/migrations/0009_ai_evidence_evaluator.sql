-- SÓCRATES DS V1.2 — AI Evidence Evaluator
-- Independent, non-official evaluation is stored alongside learner self-score.
-- Calibration uses evaluator score only when evaluator confidence >= 0.65.

create table if not exists public.sds_attempt_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.sds_attempts(id) on delete cascade,
  evaluation_version integer not null default 1 check (evaluation_version >= 1),
  status text not null default 'completed'
    check (status in ('completed','insufficient','unavailable')),
  evaluator_type text not null default 'ai'
    check (evaluator_type in ('ai','human','rule')),
  score numeric check (score is null or (score >= 0 and score <= 1)),
  evaluator_confidence numeric
    check (evaluator_confidence is null or (evaluator_confidence >= 0 and evaluator_confidence <= 1)),
  verdict text
    check (verdict is null or verdict in ('strong','partial','weak','insufficient')),
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  feedback text,
  next_prompt text,
  rubric jsonb not null default '{}'::jsonb,
  provider text,
  model text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique(attempt_id, evaluation_version)
);

create index if not exists sds_idx_attempt_evaluations_user_recent
  on public.sds_attempt_evaluations(user_id, created_at desc);

create index if not exists sds_idx_attempt_evaluations_attempt_version
  on public.sds_attempt_evaluations(attempt_id, evaluation_version desc);

alter table public.sds_attempt_evaluations enable row level security;

drop policy if exists "sds attempt evaluations own" on public.sds_attempt_evaluations;
create policy "sds attempt evaluations own"
on public.sds_attempt_evaluations
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.sds_attempt_effective_scores()
returns table (
  attempt_id uuid,
  concept_id uuid,
  confidence numeric,
  self_score numeric,
  evaluator_score numeric,
  evaluator_confidence numeric,
  effective_score numeric,
  score_source text,
  attempt_created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
with latest_eval as (
  select distinct on (e.attempt_id)
    e.attempt_id,
    e.status,
    e.score,
    e.evaluator_confidence
  from public.sds_attempt_evaluations e
  where e.user_id = auth.uid()
  order by e.attempt_id, e.evaluation_version desc, e.created_at desc
)
select
  a.id as attempt_id,
  a.concept_id,
  a.confidence,
  a.self_score,
  le.score as evaluator_score,
  le.evaluator_confidence,
  case
    when le.status='completed'
      and le.score is not null
      and coalesce(le.evaluator_confidence,0) >= 0.65
      then le.score
    else a.self_score
  end as effective_score,
  case
    when le.status='completed'
      and le.score is not null
      and coalesce(le.evaluator_confidence,0) >= 0.65
      then 'evaluator'
    else 'self_score'
  end::text as score_source,
  a.created_at as attempt_created_at
from public.sds_attempts a
left join latest_eval le on le.attempt_id=a.id
where a.user_id=auth.uid()
  and a.concept_id is not null
  and a.confidence is not null
  and a.self_score is not null;
$$;

grant execute on function public.sds_attempt_effective_scores() to authenticated;

create or replace function public.sds_calibration_profile_v2()
returns table (
  concept_id uuid,
  concept_title text,
  attempts integer,
  evaluated_attempts integer,
  avg_confidence numeric,
  avg_self_score numeric,
  avg_performance numeric,
  calibration_gap numeric,
  calibration_state text,
  score_source text,
  last_attempt_at timestamptz
)
language sql
security definer
set search_path = public
as $$
with scores as (
  select * from public.sds_attempt_effective_scores()
)
select
  s.concept_id,
  c.title::text,
  count(*)::integer as attempts,
  count(*) filter (where s.score_source='evaluator')::integer as evaluated_attempts,
  round(avg(s.confidence)::numeric,3) as avg_confidence,
  round(avg(s.self_score)::numeric,3) as avg_self_score,
  round(avg(s.effective_score)::numeric,3) as avg_performance,
  round((avg(s.confidence)-avg(s.effective_score))::numeric,3) as calibration_gap,
  case
    when count(*) < 2 then 'insufficient'
    when avg(s.confidence)-avg(s.effective_score) >= 0.20 then 'overconfident'
    when avg(s.effective_score)-avg(s.confidence) >= 0.20 then 'underconfident'
    else 'calibrated'
  end::text as calibration_state,
  case
    when count(*) filter (where s.score_source='evaluator') = count(*) then 'evaluator'
    when count(*) filter (where s.score_source='evaluator') > 0 then 'mixed'
    else 'self_score'
  end::text as score_source,
  max(s.attempt_created_at) as last_attempt_at
from scores s
join public.sds_concepts c on c.id=s.concept_id
group by s.concept_id,c.title;
$$;

grant execute on function public.sds_calibration_profile_v2() to authenticated;

create or replace function public.sds_reinforcement_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
with
cal as (
  select * from public.sds_calibration_profile_v2()
),
dependency_risk as (
  select count(*)::integer as n
  from public.sds_concept_dependencies d
  left join public.sds_mastery_states dep
    on dep.user_id = auth.uid()
   and dep.concept_id = d.dependent_concept_id
  left join public.sds_mastery_states pre
    on pre.user_id = auth.uid()
   and pre.concept_id = d.prerequisite_concept_id
  where dep.evidence_count > 0
    and coalesce(dep.conceptual, dep.mathematical, dep.coding, dep.transfer, dep.retention, 0) < 0.70
    and (
      pre.concept_id is null
      or pre.evidence_count = 0
      or coalesce(pre.conceptual, pre.mathematical, pre.coding, pre.transfer, pre.retention, 0) < 0.65
    )
),
deferrals as (
  select
    coalesce(sum(dismissed_count),0)::integer as total_dismissals,
    count(*) filter (where dismissed_count >= 2)::integer as repeated
  from public.sds_learning_action_state
  where user_id = auth.uid()
),
due_reviews as (
  select count(*)::integer as n
  from public.sds_review_items
  where user_id=auth.uid()
    and status in ('scheduled','due')
    and due_at <= now()
),
misconceptions as (
  select count(*)::integer as n
  from public.sds_misconceptions
  where user_id=auth.uid()
    and status in ('open','improving','reopened')
)
select jsonb_build_object(
  'attempts', coalesce((select sum(attempts) from cal),0),
  'evaluated_attempts', coalesce((select sum(evaluated_attempts) from cal),0),
  'calibrated_concepts', coalesce((select count(*) from cal where calibration_state='calibrated'),0),
  'overconfident_concepts', coalesce((select count(*) from cal where calibration_state='overconfident'),0),
  'underconfident_concepts', coalesce((select count(*) from cal where calibration_state='underconfident'),0),
  'avg_absolute_calibration_gap', coalesce(
    (select round(avg(abs(calibration_gap))::numeric,3) from cal where attempts >= 2),0
  ),
  'prerequisite_risks', (select n from dependency_risk),
  'total_deferrals', (select total_dismissals from deferrals),
  'repeated_deferrals', (select repeated from deferrals),
  'due_reviews', (select n from due_reviews),
  'open_misconceptions', (select n from misconceptions)
);
$$;

grant execute on function public.sds_reinforcement_snapshot() to authenticated;

create or replace function public.sds_next_best_learning_actions(p_limit integer default 3)
returns table (
  priority_score numeric,
  action_type text,
  title text,
  body text,
  reason text,
  target_tab text,
  entity_id uuid,
  course_name text,
  concept_title text,
  estimated_minutes integer,
  due_at timestamptz
)
language sql
security definer
set search_path = public
as $$
with
state as (
  select *
  from public.sds_learning_action_state
  where user_id = auth.uid()
),
due_reviews as (
  select
    (100 + least(30, greatest(0, floor(extract(epoch from (now() - r.due_at)) / 86400))))::numeric as priority_score,
    'review'::text as action_type,
    ('Recupera: ' || c.title)::text as title,
    'Haz recuperación activa sin mirar apuntes antes de consumir contenido nuevo.'::text as body,
    (
      case
        when r.due_at < now() - interval '1 day'
          then 'Revisión vencida: la retención tiene prioridad sobre nueva exposición.'
        else 'La repetición espaciada está venciendo ahora.'
      end
      || coalesce(' · ' || r.reason, '')
    )::text as reason,
    'socrates'::text as target_tab,
    r.id as entity_id,
    null::text as course_name,
    c.title::text as concept_title,
    10::integer as estimated_minutes,
    r.due_at
  from public.sds_review_items r
  join public.sds_concepts c on c.id = r.concept_id
  left join state s
    on s.action_key = public.sds_action_key('review', r.id)
  where r.user_id = auth.uid()
    and r.status in ('scheduled','due')
    and r.due_at <= now()
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
),
open_misconceptions as (
  select
    (88 + m.severity * 3)::numeric as priority_score,
    'misconception'::text as action_type,
    ('Diagnostica: ' || m.title)::text as title,
    coalesce(m.description, 'Aísla el error antes de añadir dificultad nueva.')::text as body,
    ('Misconception abierta · severidad ' || m.severity || '. Corregir una representación errónea evita practicar el error.')::text as reason,
    'socrates'::text as target_tab,
    m.id as entity_id,
    null::text as course_name,
    c.title::text as concept_title,
    12::integer as estimated_minutes,
    null::timestamptz as due_at
  from public.sds_misconceptions m
  left join public.sds_concepts c on c.id = m.concept_id
  left join state s
    on s.action_key = public.sds_action_key('misconception', m.id)
  where m.user_id = auth.uid()
    and m.status in ('open','improving','reopened')
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
),
deferral_rescue as (
  select
    (93 + least(6, s.dismissed_count))::numeric as priority_score,
    'deferral_rescue'::text as action_type,
    'Rescate de 10 minutos'::text as title,
    case
      when s.action_type='reading'
        then 'Has pospuesto esta acción varias veces. Reduce el alcance: completa solo una micro-evidencia de 10 minutos.'
      else 'Has pospuesto esta intervención varias veces. Haz una versión mínima: una pregunta, una explicación o un ejemplo.'
    end::text as body,
    ('Detecté ' || s.dismissed_count || ' postergaciones de la misma acción. Reducir alcance es mejor que seguir acumulando deuda.')::text as reason,
    case when s.action_type='reading' then 'reading' else 'socrates' end::text as target_tab,
    s.entity_id,
    null::text as course_name,
    null::text as concept_title,
    10::integer as estimated_minutes,
    null::timestamptz as due_at
  from state s
  where s.dismissed_count >= 2
    and s.completed_count = 0
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
    and s.action_type <> 'deferral_rescue'
),
calibration_actions as (
  select
    case
      when cp.calibration_state='overconfident' then 91
      else 82
    end::numeric as priority_score,
    'calibration'::text as action_type,
    case
      when cp.calibration_state='overconfident'
        then ('Calibra tu confianza: ' || cp.concept_title)
      else ('Comprueba lo que sí sabes: ' || cp.concept_title)
    end::text as title,
    case
      when cp.calibration_state='overconfident'
        then 'Tu confianza media supera claramente la evidencia efectiva. Haz una prueba cerrada antes de avanzar.'
      else 'La evidencia efectiva supera claramente tu confianza. Haz una prueba corta para evitar subestimar evidencia sólida.'
    end::text as body,
    (
      'Gap confianza−evidencia: '
      || round(cp.calibration_gap * 100)::text || ' pp en '
      || cp.attempts::text || ' intentos'
      || ' · fuente de score: ' || cp.score_source || '.'
    )::text as reason,
    'socrates'::text as target_tab,
    cp.concept_id as entity_id,
    null::text as course_name,
    cp.concept_title::text,
    12::integer as estimated_minutes,
    null::timestamptz as due_at
  from public.sds_calibration_profile_v2() cp
  left join state s
    on s.action_key = public.sds_action_key('calibration', cp.concept_id)
  where cp.attempts >= 2
    and cp.calibration_state in ('overconfident','underconfident')
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
),
mastery_scored as (
  select
    m.*,
    c.title as concept_title,
    (
      coalesce(m.conceptual,0) +
      coalesce(m.mathematical,0) +
      coalesce(m.coding,0) +
      coalesce(m.transfer,0) +
      coalesce(m.retention,0)
    ) /
    greatest(
      (m.conceptual is not null)::int +
      (m.mathematical is not null)::int +
      (m.coding is not null)::int +
      (m.transfer is not null)::int +
      (m.retention is not null)::int,
      1
    )::numeric as evidence_average
  from public.sds_mastery_states m
  join public.sds_concepts c on c.id = m.concept_id
  where m.user_id = auth.uid()
    and m.evidence_count > 0
),
prerequisite_rescue as (
  select distinct on (dep.concept_id, pre.id)
    (
      84
      + case when coalesce(pre_m.evidence_count,0)=0 then 4 else 0 end
      + greatest(0, round((0.65 - coalesce(
          (
            coalesce(pre_m.conceptual,0) +
            coalesce(pre_m.mathematical,0) +
            coalesce(pre_m.coding,0) +
            coalesce(pre_m.transfer,0) +
            coalesce(pre_m.retention,0)
          ) / greatest(
            (pre_m.conceptual is not null)::int +
            (pre_m.mathematical is not null)::int +
            (pre_m.coding is not null)::int +
            (pre_m.transfer is not null)::int +
            (pre_m.retention is not null)::int,
            1
          )::numeric,
          0
        )) * 10
      ))
    )::numeric as priority_score,
    'prerequisite_rescue'::text as action_type,
    ('Rescata prerrequisito: ' || pre.title)::text as title,
    ('Antes de seguir con ' || dep.concept_title || ', demuestra el prerrequisito en una micro-sesión.')::text as body,
    (
      'El grafo marca ' || pre.title || ' como prerrequisito de '
      || dep.concept_title || coalesce(' · ' || d.rationale,'')
    )::text as reason,
    'socrates'::text as target_tab,
    pre.id as entity_id,
    null::text as course_name,
    pre.title::text as concept_title,
    12::integer as estimated_minutes,
    null::timestamptz as due_at
  from mastery_scored dep
  join public.sds_concept_dependencies d
    on d.dependent_concept_id = dep.concept_id
  join public.sds_concepts pre
    on pre.id = d.prerequisite_concept_id
  left join public.sds_mastery_states pre_m
    on pre_m.user_id = auth.uid()
   and pre_m.concept_id = pre.id
  left join state s
    on s.action_key = public.sds_action_key('prerequisite_rescue', pre.id)
  where dep.evidence_average < 0.70
    and (
      pre_m.concept_id is null
      or pre_m.evidence_count = 0
      or (
        (
          coalesce(pre_m.conceptual,0) +
          coalesce(pre_m.mathematical,0) +
          coalesce(pre_m.coding,0) +
          coalesce(pre_m.transfer,0) +
          coalesce(pre_m.retention,0)
        ) / greatest(
          (pre_m.conceptual is not null)::int +
          (pre_m.mathematical is not null)::int +
          (pre_m.coding is not null)::int +
          (pre_m.transfer is not null)::int +
          (pre_m.retention is not null)::int,
          1
        )::numeric
      ) < 0.65
    )
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
  order by dep.concept_id, pre.id, d.strength desc
),
reading_ranked as (
  select
    ut.id as entity_id,
    t.id as template_id,
    t.sequence,
    t.priority,
    t.title as task_title,
    t.instructions,
    t.estimated_minutes,
    t.task_type,
    u.id as reading_unit_id,
    u.title as unit_title,
    u.sequence as unit_sequence,
    u.grounding_status,
    u.owner_user_id,
    crs.name as course_name,
    crs.day_of_week,
    ut.status,
    lag(ut.status) over (
      partition by u.id
      order by t.sequence
    ) as previous_status
  from public.sds_user_reading_tasks ut
  join public.sds_reading_task_templates t
    on t.id = ut.template_id and t.active
  join public.sds_reading_units u
    on u.id = t.reading_unit_id and u.active
  join public.sds_courses crs
    on crs.id = u.course_id and crs.active
  where ut.user_id = auth.uid()
    and (u.owner_user_id is null or u.owner_user_id = auth.uid())
),
reading_candidates as (
  select
    rr.*,
    row_number() over (
      partition by rr.course_name
      order by
        case when rr.grounding_status = 'source_grounded' then 0 else 1 end,
        rr.unit_sequence,
        rr.sequence,
        rr.task_title
    ) as course_rank
  from reading_ranked rr
  left join state s
    on s.action_key = public.sds_action_key('reading', rr.entity_id)
  where rr.status not in ('completed','skipped')
    and (rr.sequence = 1 or rr.previous_status = 'completed')
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
),
reading_actions as (
  select
    (
      70
      + least(5, priority)
      + case when grounding_status = 'source_grounded' then 5 else 0 end
      + case when task_type in ('explain','solve','derive','apply') then 3 else 0 end
    )::numeric as priority_score,
    'reading'::text as action_type,
    task_title::text as title,
    (instructions || ' · ' || unit_title)::text as body,
    (
      case
        when task_type = 'preview' then 'Primera acción incompleta de una Reading Mission.'
        when task_type = 'read' then 'El preview está cerrado; falta lectura activa.'
        when task_type = 'explain' then 'La fuente fue leída, pero aún falta recuperación sin mirar.'
        when task_type in ('solve','derive','apply') then 'Falta evidencia de resolución o transferencia.'
        else 'Primera acción desbloqueada aún pendiente.'
      end
      || case when grounding_status = 'source_grounded' then ' · Source-grounded.' else '' end
    )::text as reason,
    'reading'::text as target_tab,
    entity_id,
    course_name::text,
    null::text as concept_title,
    estimated_minutes::integer,
    null::timestamptz as due_at
  from reading_candidates
  where course_rank = 1
),
weak_mastery as (
  select
    (55 + (1 - least(1, greatest(0, evidence_average))) * 20)::numeric as priority_score,
    'weak_mastery'::text as action_type,
    ('Refuerza: ' || concept_title)::text as title,
    'Haz una prueba corta que obligue a recuperar, resolver o transferir el concepto.'::text as body,
    (
      'Es tu evidencia promedio más débil entre conceptos ya observados: '
      || round(evidence_average * 100)::text || '%.'
    )::text as reason,
    'socrates'::text as target_tab,
    concept_id as entity_id,
    null::text as course_name,
    concept_title::text,
    15::integer as estimated_minutes,
    null::timestamptz as due_at
  from mastery_scored wm
  left join state s
    on s.action_key = public.sds_action_key('weak_mastery', wm.concept_id)
  where evidence_average < 0.70
    and coalesce(s.snoozed_until, '-infinity'::timestamptz) <= now()
),
baseline as (
  select
    40::numeric as priority_score,
    'baseline'::text as action_type,
    'Crea tu primera línea base'::text as title,
    'Completa una sesión corta para separar lo que reconoces de lo que realmente puedes explicar o resolver.'::text as body,
    'No existe todavía evidencia de mastery para personalizar con fiabilidad.'::text as reason,
    'socrates'::text as target_tab,
    null::uuid as entity_id,
    null::text as course_name,
    null::text as concept_title,
    12::integer as estimated_minutes,
    null::timestamptz as due_at
  where not exists (
    select 1 from public.sds_mastery_states m
    where m.user_id = auth.uid() and m.evidence_count > 0
  )
  and not exists (
    select 1 from state s
    where s.action_key=public.sds_action_key('baseline',null)
      and coalesce(s.snoozed_until,'-infinity'::timestamptz)>now()
  )
),
all_actions as (
  select * from due_reviews
  union all select * from open_misconceptions
  union all select * from deferral_rescue
  union all select * from calibration_actions
  union all select * from prerequisite_rescue
  union all select * from reading_actions
  union all select * from weak_mastery
  union all select * from baseline
)
select *
from all_actions
order by priority_score desc, due_at nulls last, title
limit greatest(1, least(coalesce(p_limit,3),10));
$$;

grant execute on function public.sds_next_best_learning_actions(integer) to authenticated;
