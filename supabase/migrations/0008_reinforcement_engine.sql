-- SÓCRATES DS V1.1 — Reinforcement Engine
-- Transparent, deterministic reinforcement before adaptive ML.
-- Adds snooze/deferral state, calibration diagnostics, prerequisite rescue,
-- and a reinforcement snapshot for the learner-facing UI.

alter table public.sds_learning_action_events
  drop constraint if exists sds_learning_action_events_action_type_check;

alter table public.sds_learning_action_events
  add constraint sds_learning_action_events_action_type_check
  check (action_type in (
    'review','misconception','reading','weak_mastery','baseline',
    'calibration','prerequisite_rescue','deferral_rescue'
  ));

create table if not exists public.sds_learning_action_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  action_type text not null
    check (action_type in (
      'review','misconception','reading','weak_mastery','baseline',
      'calibration','prerequisite_rescue','deferral_rescue'
    )),
  entity_id uuid,
  snoozed_until timestamptz,
  shown_count integer not null default 0 check (shown_count >= 0),
  opened_count integer not null default 0 check (opened_count >= 0),
  dismissed_count integer not null default 0 check (dismissed_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  last_shown_at timestamptz,
  last_opened_at timestamptz,
  last_dismissed_at timestamptz,
  last_completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, action_key)
);

create index if not exists sds_idx_learning_action_state_user
  on public.sds_learning_action_state(user_id, snoozed_until, dismissed_count desc);

alter table public.sds_learning_action_state enable row level security;

drop policy if exists "sds learning action state own" on public.sds_learning_action_state;
create policy "sds learning action state own"
on public.sds_learning_action_state
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists sds_learning_action_state_updated_at on public.sds_learning_action_state;
create trigger sds_learning_action_state_updated_at
before update on public.sds_learning_action_state
for each row execute function public.sds_set_updated_at();

create or replace function public.sds_action_key(
  p_action_type text,
  p_entity_id uuid
)
returns text
language sql
immutable
as $$
  select p_action_type || ':' || coalesce(p_entity_id::text, 'none');
$$;

create or replace function public.sds_log_learning_action_event(
  p_action_type text,
  p_entity_id uuid,
  p_event_type text,
  p_priority_score numeric default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_key text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;

  if p_action_type not in (
    'review','misconception','reading','weak_mastery','baseline',
    'calibration','prerequisite_rescue','deferral_rescue'
  ) then
    raise exception 'invalid action_type';
  end if;

  if p_event_type not in ('shown','opened','dismissed','completed') then
    raise exception 'invalid event_type';
  end if;

  v_key := public.sds_action_key(p_action_type, p_entity_id);

  insert into public.sds_learning_action_events(
    user_id, action_type, entity_id, event_type, priority_score, reason, metadata
  ) values (
    v_uid, p_action_type, p_entity_id, p_event_type,
    p_priority_score, p_reason, coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  insert into public.sds_learning_action_state(
    user_id, action_key, action_type, entity_id,
    shown_count, opened_count, dismissed_count, completed_count,
    last_shown_at, last_opened_at, last_dismissed_at, last_completed_at,
    metadata
  ) values (
    v_uid, v_key, p_action_type, p_entity_id,
    case when p_event_type='shown' then 1 else 0 end,
    case when p_event_type='opened' then 1 else 0 end,
    case when p_event_type='dismissed' then 1 else 0 end,
    case when p_event_type='completed' then 1 else 0 end,
    case when p_event_type='shown' then now() else null end,
    case when p_event_type='opened' then now() else null end,
    case when p_event_type='dismissed' then now() else null end,
    case when p_event_type='completed' then now() else null end,
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (user_id, action_key) do update set
    action_type = excluded.action_type,
    entity_id = excluded.entity_id,
    shown_count = public.sds_learning_action_state.shown_count
      + case when p_event_type='shown' then 1 else 0 end,
    opened_count = public.sds_learning_action_state.opened_count
      + case when p_event_type='opened' then 1 else 0 end,
    dismissed_count = public.sds_learning_action_state.dismissed_count
      + case when p_event_type='dismissed' then 1 else 0 end,
    completed_count = public.sds_learning_action_state.completed_count
      + case when p_event_type='completed' then 1 else 0 end,
    last_shown_at = case
      when p_event_type='shown' then now()
      else public.sds_learning_action_state.last_shown_at end,
    last_opened_at = case
      when p_event_type='opened' then now()
      else public.sds_learning_action_state.last_opened_at end,
    last_dismissed_at = case
      when p_event_type='dismissed' then now()
      else public.sds_learning_action_state.last_dismissed_at end,
    last_completed_at = case
      when p_event_type='completed' then now()
      else public.sds_learning_action_state.last_completed_at end,
    snoozed_until = case
      when p_event_type='completed' then null
      else public.sds_learning_action_state.snoozed_until end,
    metadata = public.sds_learning_action_state.metadata || coalesce(p_metadata,'{}'::jsonb);

  return v_id;
end;
$$;

grant execute on function public.sds_log_learning_action_event(text,uuid,text,numeric,text,jsonb) to authenticated;

create or replace function public.sds_snooze_learning_action(
  p_action_type text,
  p_entity_id uuid,
  p_hours integer default 24,
  p_priority_score numeric default null,
  p_reason text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_until timestamptz;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_hours < 1 or p_hours > 168 then raise exception 'p_hours must be 1..168'; end if;

  v_key := public.sds_action_key(p_action_type, p_entity_id);
  v_until := now() + make_interval(hours => p_hours);

  perform public.sds_log_learning_action_event(
    p_action_type,
    p_entity_id,
    'dismissed',
    p_priority_score,
    p_reason,
    jsonb_build_object('snooze_hours', p_hours)
  );

  update public.sds_learning_action_state
  set snoozed_until = v_until
  where user_id = v_uid and action_key = v_key;

  return v_until;
end;
$$;

grant execute on function public.sds_snooze_learning_action(text,uuid,integer,numeric,text) to authenticated;

create or replace function public.sds_calibration_profile()
returns table (
  concept_id uuid,
  concept_title text,
  attempts integer,
  avg_confidence numeric,
  avg_self_score numeric,
  calibration_gap numeric,
  calibration_state text,
  last_attempt_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    a.concept_id,
    c.title::text,
    count(*)::integer as attempts,
    round(avg(a.confidence)::numeric, 3) as avg_confidence,
    round(avg(a.self_score)::numeric, 3) as avg_self_score,
    round((avg(a.confidence) - avg(a.self_score))::numeric, 3) as calibration_gap,
    case
      when count(*) < 2 then 'insufficient'
      when avg(a.confidence) - avg(a.self_score) >= 0.20 then 'overconfident'
      when avg(a.self_score) - avg(a.confidence) >= 0.20 then 'underconfident'
      else 'calibrated'
    end::text as calibration_state,
    max(a.created_at) as last_attempt_at
  from public.sds_attempts a
  join public.sds_concepts c on c.id = a.concept_id
  where a.user_id = auth.uid()
    and a.concept_id is not null
    and a.confidence is not null
    and a.self_score is not null
  group by a.concept_id, c.title;
$$;

grant execute on function public.sds_calibration_profile() to authenticated;

create or replace function public.sds_reinforcement_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
with
cal as (
  select * from public.sds_calibration_profile()
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
    and (
      coalesce(dep.conceptual, dep.mathematical, dep.coding, dep.transfer, dep.retention, 0) < 0.70
    )
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
        then 'Tu confianza media supera claramente tu autoevaluación. Haz una prueba cerrada antes de avanzar.'
      else 'Tu autoevaluación supera claramente tu confianza. Haz una prueba corta para evitar subestimar evidencia sólida.'
    end::text as body,
    (
      'Gap confianza−desempeño autoevaluado: '
      || round(cp.calibration_gap * 100)::text || ' pp en '
      || cp.attempts::text || ' intentos.'
    )::text as reason,
    'socrates'::text as target_tab,
    cp.concept_id as entity_id,
    null::text as course_name,
    cp.concept_title::text,
    12::integer as estimated_minutes,
    null::timestamptz as due_at
  from public.sds_calibration_profile() cp
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
