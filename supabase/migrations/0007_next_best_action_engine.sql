-- SÓCRATES DS V1.0 — transparent Next-Best Learning Action engine
-- Deterministic SQL rules before ML. Every recommendation exposes its reason.

create table if not exists public.sds_learning_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null
    check (action_type in ('review','misconception','reading','weak_mastery','baseline')),
  entity_id uuid,
  event_type text not null
    check (event_type in ('shown','opened','dismissed','completed')),
  priority_score numeric,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sds_idx_learning_action_events_user_recent
  on public.sds_learning_action_events(user_id, created_at desc);

alter table public.sds_learning_action_events enable row level security;

drop policy if exists "sds learning action events own" on public.sds_learning_action_events;
create policy "sds learning action events own"
on public.sds_learning_action_events
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
  where r.user_id = auth.uid()
    and r.status in ('scheduled','due')
    and r.due_at <= now()
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
  where m.user_id = auth.uid()
    and m.status in ('open','improving','reopened')
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
  where rr.status not in ('completed','skipped')
    and (rr.sequence = 1 or rr.previous_status = 'completed')
),
reading_actions as (
  select
    (
      70
      + least(5, priority)
      + case when grounding_status = 'source_grounded' then 5 else 0 end
      + case
          when task_type in ('explain','solve','derive','apply') then 3
          else 0
        end
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
  from mastery_scored
  where evidence_average < 0.70
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
),
all_actions as (
  select * from due_reviews
  union all
  select * from open_misconceptions
  union all
  select * from reading_actions
  union all
  select * from weak_mastery
  union all
  select * from baseline
)
select *
from all_actions
order by priority_score desc, due_at nulls last, title
limit greatest(1, least(coalesce(p_limit,3),10));
$$;

grant execute on function public.sds_next_best_learning_actions(integer) to authenticated;

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
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_action_type not in ('review','misconception','reading','weak_mastery','baseline') then
    raise exception 'invalid action_type';
  end if;
  if p_event_type not in ('shown','opened','dismissed','completed') then
    raise exception 'invalid event_type';
  end if;

  insert into public.sds_learning_action_events(
    user_id, action_type, entity_id, event_type, priority_score, reason, metadata
  ) values (
    v_uid, p_action_type, p_entity_id, p_event_type, p_priority_score, p_reason,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.sds_log_learning_action_event(text,uuid,text,numeric,text,jsonb) to authenticated;
