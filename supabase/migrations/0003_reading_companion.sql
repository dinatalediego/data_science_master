-- SÓCRATES DS V0.6 — Reading Companion / Study Missions
-- Source-aware study plans, derivative learning artifacts, and actionable checklists.

do $$ begin
  create type public.sds_reading_task_status as enum (
    'pending','in_progress','completed','skipped'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.sds_reading_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text,
  institution_or_publisher text,
  publication_year integer,
  source_kind text not null
    check (source_kind in ('uploaded_book','uploaded_note','official_open_resource','external_reference')),
  external_url text,
  access_note text,
  citation_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sds_reading_units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  course_id uuid not null references public.sds_courses(id) on delete cascade,
  source_id uuid references public.sds_reading_sources(id) on delete set null,
  external_resource_id uuid references public.sds_external_resources(id) on delete set null,
  week_label text not null default 'Primeras semanas',
  sequence integer not null default 1,
  title text not null,
  source_locator text,
  objective text not null,
  why_it_matters text not null,
  estimated_minutes integer not null default 30 check (estimated_minutes > 0),
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  grounding_status text not null default 'source_grounded'
    check (grounding_status in ('source_grounded','official_resource_mapped','needs_syllabus_alignment')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_id is not null or external_resource_id is not null)
);

create table if not exists public.sds_reading_artifacts (
  id uuid primary key default gen_random_uuid(),
  reading_unit_id uuid not null references public.sds_reading_units(id) on delete cascade,
  artifact_type text not null
    check (artifact_type in (
      'orientation_letter','summary','concept_cards','infographic',
      'checklist','derivation_sheet','practice_set','socratic_prompts'
    )),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  generated_from text not null default 'curated_source',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(reading_unit_id, artifact_type, title)
);

create table if not exists public.sds_reading_task_templates (
  id uuid primary key default gen_random_uuid(),
  reading_unit_id uuid not null references public.sds_reading_units(id) on delete cascade,
  task_key text not null,
  sequence integer not null,
  task_type text not null
    check (task_type in ('preview','read','derive','explain','solve','apply','recall','reflect')),
  title text not null,
  instructions text not null,
  evidence_expected text,
  estimated_minutes integer not null default 15 check (estimated_minutes > 0),
  priority smallint not null default 2 check (priority between 1 and 5),
  unlock_after_task_key text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(reading_unit_id, task_key)
);

create table if not exists public.sds_user_reading_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.sds_reading_task_templates(id) on delete cascade,
  status public.sds_reading_task_status not null default 'pending',
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_prompted_at timestamptz,
  prompted_count integer not null default 0 check (prompted_count >= 0),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, template_id)
);

create index if not exists sds_idx_reading_units_course
  on public.sds_reading_units(course_id, sequence);
create index if not exists sds_idx_reading_tasks_user_status
  on public.sds_user_reading_tasks(user_id, status, due_at);
create index if not exists sds_idx_reading_templates_unit
  on public.sds_reading_task_templates(reading_unit_id, sequence);

drop trigger if exists sds_reading_sources_updated_at on public.sds_reading_sources;
create trigger sds_reading_sources_updated_at
before update on public.sds_reading_sources
for each row execute function public.sds_set_updated_at();

drop trigger if exists sds_reading_units_updated_at on public.sds_reading_units;
create trigger sds_reading_units_updated_at
before update on public.sds_reading_units
for each row execute function public.sds_set_updated_at();

drop trigger if exists sds_user_reading_tasks_updated_at on public.sds_user_reading_tasks;
create trigger sds_user_reading_tasks_updated_at
before update on public.sds_user_reading_tasks
for each row execute function public.sds_set_updated_at();

alter table public.sds_reading_sources enable row level security;
alter table public.sds_reading_units enable row level security;
alter table public.sds_reading_artifacts enable row level security;
alter table public.sds_reading_task_templates enable row level security;
alter table public.sds_user_reading_tasks enable row level security;

create policy "sds reading sources read"
on public.sds_reading_sources
for select to authenticated using (active);

create policy "sds reading units read"
on public.sds_reading_units
for select to authenticated using (active);

create policy "sds reading artifacts read"
on public.sds_reading_artifacts
for select to authenticated using (active);

create policy "sds reading task templates read"
on public.sds_reading_task_templates
for select to authenticated using (active);

create policy "sds user reading tasks own"
on public.sds_user_reading_tasks
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.sds_bootstrap_reading_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inserted_count integer;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  insert into public.sds_user_reading_tasks(user_id, template_id)
  select uid, t.id
  from public.sds_reading_task_templates t
  join public.sds_reading_units u on u.id = t.reading_unit_id
  join public.sds_enrollments e on e.course_id = u.course_id and e.user_id = uid
  where t.active and u.active
  on conflict (user_id, template_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.sds_bootstrap_reading_tasks() to authenticated;

create or replace function public.sds_log_reading_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_unit_id uuid;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());

    select u.course_id, u.id
      into v_course_id, v_unit_id
    from public.sds_reading_task_templates t
    join public.sds_reading_units u on u.id = t.reading_unit_id
    where t.id = new.template_id;

    insert into public.sds_learning_events(
      user_id, course_id, event_type, payload
    ) values (
      new.user_id,
      v_course_id,
      'reading_task_completed',
      jsonb_build_object(
        'reading_unit_id', v_unit_id,
        'template_id', new.template_id,
        'completed_at', new.completed_at
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sds_reading_task_completion_event on public.sds_user_reading_tasks;
create trigger sds_reading_task_completion_event
before update of status on public.sds_user_reading_tasks
for each row execute function public.sds_log_reading_completion();
