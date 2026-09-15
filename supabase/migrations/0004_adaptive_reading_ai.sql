-- SÓCRATES DS V0.7 — Adaptive Reading Intelligence
-- Adds source-grounded retrieval, concept mappings, AI interaction audit,
-- and a checklist completion RPC that schedules spaced retrieval.

create table if not exists public.sds_reading_unit_concepts (
  reading_unit_id uuid not null references public.sds_reading_units(id) on delete cascade,
  concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  role text not null default 'core'
    check (role in ('prerequisite','core','extension')),
  weight numeric not null default 1
    check (weight > 0 and weight <= 1),
  primary key (reading_unit_id, concept_id)
);

create table if not exists public.sds_source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sds_reading_sources(id) on delete cascade,
  reading_unit_id uuid references public.sds_reading_units(id) on delete cascade,
  sequence integer not null default 1,
  heading text,
  locator text not null,
  content_note text not null,
  keywords text[] not null default '{}',
  search_document tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(heading,'') || ' ' ||
      coalesce(locator,'') || ' ' ||
      coalesce(content_note,'') || ' ' ||
      array_to_string(keywords, ' ')
    )
  ) stored,
  created_at timestamptz not null default now(),
  unique(source_id, locator, sequence)
);

create table if not exists public.sds_ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_unit_id uuid references public.sds_reading_units(id) on delete set null,
  mode text not null
    check (mode in (
      'explain','socratic','quiz','derive','apply',
      'summary','concept_cards','infographic','checklist'
    )),
  prompt text not null,
  response_text text not null,
  source_chunk_ids uuid[] not null default '{}',
  source_locators text[] not null default '{}',
  provider text not null default 'fallback',
  model text,
  grounding_status text not null default 'grounded'
    check (grounding_status in ('grounded','partial','insufficient')),
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists sds_idx_reading_unit_concepts_concept
  on public.sds_reading_unit_concepts(concept_id, reading_unit_id);

create index if not exists sds_idx_source_chunks_unit
  on public.sds_source_chunks(reading_unit_id, sequence);

create index if not exists sds_idx_source_chunks_source
  on public.sds_source_chunks(source_id, sequence);

create index if not exists sds_idx_source_chunks_search
  on public.sds_source_chunks using gin(search_document);

create index if not exists sds_idx_ai_interactions_user_recent
  on public.sds_ai_interactions(user_id, created_at desc);

alter table public.sds_reading_unit_concepts enable row level security;
alter table public.sds_source_chunks enable row level security;
alter table public.sds_ai_interactions enable row level security;

drop policy if exists "sds reading unit concepts read" on public.sds_reading_unit_concepts;
create policy "sds reading unit concepts read"
on public.sds_reading_unit_concepts
for select to authenticated
using (true);

drop policy if exists "sds source chunks read" on public.sds_source_chunks;
create policy "sds source chunks read"
on public.sds_source_chunks
for select to authenticated
using (true);

drop policy if exists "sds ai interactions own" on public.sds_ai_interactions;
create policy "sds ai interactions own"
on public.sds_ai_interactions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.sds_search_reading_chunks(
  p_reading_unit_id uuid,
  p_query text default '',
  p_limit integer default 6
)
returns table (
  chunk_id uuid,
  source_id uuid,
  heading text,
  locator text,
  content_note text,
  rank real
)
language sql
security invoker
set search_path = public
as $$
  with unit_source as (
    select source_id
    from public.sds_reading_units
    where id = p_reading_unit_id and active
  ),
  candidates as (
    select
      c.id as chunk_id,
      c.source_id,
      c.heading,
      c.locator,
      c.content_note,
      case
        when nullif(trim(p_query), '') is null then 0::real
        else ts_rank_cd(c.search_document, websearch_to_tsquery('simple', p_query))
      end as rank,
      c.sequence
    from public.sds_source_chunks c
    join unit_source u on u.source_id = c.source_id
    where
      c.reading_unit_id = p_reading_unit_id
      or c.reading_unit_id is null
  )
  select chunk_id, source_id, heading, locator, content_note, rank
  from candidates
  order by
    case when nullif(trim(p_query), '') is null then 0 else (rank > 0)::int end desc,
    rank desc,
    sequence asc
  limit greatest(1, least(coalesce(p_limit, 6), 12));
$$;

grant execute on function public.sds_search_reading_chunks(uuid,text,integer) to authenticated;

create or replace function public.sds_next_reading_action()
returns table (
  user_task_id uuid,
  template_id uuid,
  reading_unit_id uuid,
  course_id uuid,
  course_name text,
  unit_title text,
  week_label text,
  task_title text,
  task_type text,
  instructions text,
  evidence_expected text,
  estimated_minutes integer,
  source_locator text,
  trigger_reason text
)
language sql
security definer
set search_path = public
as $$
  with mine as (
    select
      ut.id as user_task_id,
      t.id as template_id,
      u.id as reading_unit_id,
      u.course_id,
      c.name as course_name,
      u.title as unit_title,
      u.week_label,
      t.title as task_title,
      t.task_type,
      t.instructions,
      t.evidence_expected,
      t.estimated_minutes,
      u.source_locator,
      t.sequence,
      u.sequence as unit_sequence,
      c.day_of_week,
      ut.status,
      lag(ut.status) over (
        partition by u.id
        order by t.sequence
      ) as previous_status
    from public.sds_user_reading_tasks ut
    join public.sds_reading_task_templates t on t.id = ut.template_id and t.active
    join public.sds_reading_units u on u.id = t.reading_unit_id and u.active
    join public.sds_courses c on c.id = u.course_id and c.active
    where ut.user_id = auth.uid()
  )
  select
    user_task_id,
    template_id,
    reading_unit_id,
    course_id,
    course_name,
    unit_title,
    week_label,
    task_title,
    task_type,
    instructions,
    evidence_expected,
    estimated_minutes,
    source_locator,
    case
      when task_type = 'preview' then 'Primera acción incompleta de la ruta.'
      when task_type = 'read' then 'Ya hiciste el preview; ahora falta lectura activa.'
      when task_type = 'explain' then 'La lectura está marcada, pero aún falta recuperación sin mirar.'
      when task_type in ('solve','derive','apply') then 'Aún falta evidencia de transferencia o resolución.'
      else 'Esta es la primera acción desbloqueada que sigue pendiente.'
    end as trigger_reason
  from mine
  where status not in ('completed','skipped')
    and (sequence = 1 or previous_status = 'completed')
  order by
    unit_sequence,
    day_of_week,
    sequence
  limit 1;
$$;

grant execute on function public.sds_next_reading_action() to authenticated;

create or replace function public.sds_set_reading_task(
  p_user_task_id uuid,
  p_completed boolean,
  p_evidence text default null,
  p_confidence numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_template_id uuid;
  v_unit_id uuid;
  v_unit_slug text;
  v_sequence integer;
  v_max_sequence integer;
  v_status public.sds_reading_task_status;
  v_reviews integer := 0;
  v_concept record;
  v_interval integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then
    raise exception 'confidence must be between 0 and 1';
  end if;

  select
    ut.template_id,
    t.reading_unit_id,
    u.slug,
    t.sequence
  into
    v_template_id,
    v_unit_id,
    v_unit_slug,
    v_sequence
  from public.sds_user_reading_tasks ut
  join public.sds_reading_task_templates t on t.id = ut.template_id
  join public.sds_reading_units u on u.id = t.reading_unit_id
  where ut.id = p_user_task_id
    and ut.user_id = v_uid;

  if v_template_id is null then
    raise exception 'reading task not found';
  end if;

  select max(sequence)
  into v_max_sequence
  from public.sds_reading_task_templates
  where reading_unit_id = v_unit_id
    and active;

  v_status := case
    when p_completed then 'completed'::public.sds_reading_task_status
    else 'pending'::public.sds_reading_task_status
  end;

  update public.sds_user_reading_tasks
  set
    status = v_status,
    started_at = case
      when p_completed then coalesce(started_at, now())
      else started_at
    end,
    completed_at = case when p_completed then now() else null end,
    evidence = case
      when p_completed then
        coalesce(evidence, '{}'::jsonb)
        || jsonb_build_object(
          'reflection', nullif(trim(coalesce(p_evidence,'')), ''),
          'confidence', p_confidence,
          'recorded_at', now()
        )
      else evidence
    end
  where id = p_user_task_id
    and user_id = v_uid;

  if p_completed and v_sequence = v_max_sequence then
    for v_concept in
      select concept_id
      from public.sds_reading_unit_concepts
      where reading_unit_id = v_unit_id
        and role in ('core','prerequisite')
    loop
      foreach v_interval in array array[1,3,7,21]
      loop
        if not exists (
          select 1
          from public.sds_review_items r
          where r.user_id = v_uid
            and r.concept_id = v_concept.concept_id
            and r.reason = format('reading:%s:T+%sd', v_unit_slug, v_interval)
            and r.status in ('scheduled','due')
        ) then
          insert into public.sds_review_items(
            user_id,
            concept_id,
            due_at,
            interval_days,
            reason,
            status
          ) values (
            v_uid,
            v_concept.concept_id,
            now() + make_interval(days => v_interval),
            v_interval,
            format('reading:%s:T+%sd', v_unit_slug, v_interval),
            'scheduled'
          );
          v_reviews := v_reviews + 1;
        end if;
      end loop;
    end loop;
  end if;

  return jsonb_build_object(
    'task_id', p_user_task_id,
    'status', v_status,
    'reading_unit_id', v_unit_id,
    'scheduled_reviews', v_reviews
  );
end;
$$;

grant execute on function public.sds_set_reading_task(uuid,boolean,text,numeric) to authenticated;
