-- SÓCRATES DS V0.1 — shared Supabase-safe foundation
-- All product tables are namespaced with sds_ so this repository can safely
-- share an existing Supabase project without touching other products.

create extension if not exists pgcrypto;

do $$ begin
  create type public.sds_session_mode as enum (
    'socratic','professor','feynman','examiner','coach','debugger',
    'researcher','thesis_advisor','devils_advocate','practice','review','lab'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sds_learning_stage as enum (
    'seen','recalled','explained','solved','applied','transferred','mastered'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.sds_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Lima',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sds_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  instructor text,
  credits smallint check (credits is null or credits > 0),
  academic_hours smallint check (academic_hours is null or academic_hours > 0),
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  learning_role text not null,
  color_token text not null default 'blue',
  source_status text not null default 'unknown',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.sds_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.sds_courses(id) on delete cascade,
  term_name text not null default 'Ciclo II',
  enrolled_at timestamptz not null default now(),
  primary key (user_id, course_id, term_name)
);

create table if not exists public.sds_concepts (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  title text not null,
  description text,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.sds_course_concepts (
  course_id uuid not null references public.sds_courses(id) on delete cascade,
  concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  module text,
  role text not null default 'core',
  primary key (course_id, concept_id)
);

create table if not exists public.sds_concept_dependencies (
  prerequisite_concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  dependent_concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  strength numeric(4,3) not null default 1 check (strength > 0 and strength <= 1),
  rationale text,
  primary key (prerequisite_concept_id, dependent_concept_id),
  check (prerequisite_concept_id <> dependent_concept_id)
);

create table if not exists public.sds_question_bank (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.sds_courses(id) on delete cascade,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  mode public.sds_session_mode not null default 'socratic',
  dimension text not null default 'conceptual'
    check (dimension in ('conceptual','mathematical','coding','transfer','retention')),
  prompt text not null,
  answer_guide text,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sds_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.sds_courses(id) on delete set null,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  mode public.sds_session_mode not null,
  goal text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_minutes integer check (planned_minutes is null or planned_minutes > 0),
  reflection text,
  metadata jsonb not null default '{}'::jsonb,
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.sds_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sds_learning_sessions(id) on delete set null,
  question_id uuid references public.sds_question_bank(id) on delete set null,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  response_text text,
  self_score numeric(5,4) check (self_score is null or self_score between 0 and 1),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.sds_mastery_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  stage public.sds_learning_stage not null default 'seen',
  conceptual numeric(5,4) check (conceptual is null or conceptual between 0 and 1),
  mathematical numeric(5,4) check (mathematical is null or mathematical between 0 and 1),
  coding numeric(5,4) check (coding is null or coding between 0 and 1),
  transfer numeric(5,4) check (transfer is null or transfer between 0 and 1),
  retention numeric(5,4) check (retention is null or retention between 0 and 1),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  last_evidence_at timestamptz,
  next_review_at timestamptz,
  explanation jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create table if not exists public.sds_misconceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open','improving','resolved','reopened')),
  severity smallint not null default 2 check (severity between 1 and 5),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.sds_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  due_at timestamptz not null,
  interval_days numeric(8,2) not null default 1 check (interval_days > 0),
  reason text,
  status text not null default 'scheduled'
    check (status in ('scheduled','due','completed','skipped')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.sds_labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.sds_courses(id) on delete set null,
  title text not null,
  description text,
  repo_path text,
  status text not null default 'planned'
    check (status in ('planned','in_progress','blocked','completed','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sds_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.sds_courses(id) on delete set null,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  lab_id uuid references public.sds_labs(id) on delete set null,
  title text not null,
  kind text not null default 'other',
  uri text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.sds_calendar_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'google_calendar',
  observed_at timestamptz not null default now(),
  matched_events integer not null default 0 check (matched_events >= 0),
  unmatched_events integer not null default 0 check (unmatched_events >= 0),
  status text not null default 'observed',
  summary text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.sds_learning_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.sds_courses(id) on delete set null,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists sds_idx_sessions_user_time
  on public.sds_learning_sessions(user_id, started_at desc);
create index if not exists sds_idx_attempts_user_time
  on public.sds_attempts(user_id, created_at desc);
create index if not exists sds_idx_mastery_review
  on public.sds_mastery_states(user_id, next_review_at);
create index if not exists sds_idx_reviews_due
  on public.sds_review_items(user_id, due_at)
  where status in ('scheduled','due');
create index if not exists sds_idx_events_user_time
  on public.sds_learning_events(user_id, occurred_at desc);

create or replace function public.sds_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sds_profiles_updated_at on public.sds_profiles;
create trigger sds_profiles_updated_at
before update on public.sds_profiles
for each row execute function public.sds_set_updated_at();

drop trigger if exists sds_courses_updated_at on public.sds_courses;
create trigger sds_courses_updated_at
before update on public.sds_courses
for each row execute function public.sds_set_updated_at();

drop trigger if exists sds_mastery_updated_at on public.sds_mastery_states;
create trigger sds_mastery_updated_at
before update on public.sds_mastery_states
for each row execute function public.sds_set_updated_at();

drop trigger if exists sds_labs_updated_at on public.sds_labs;
create trigger sds_labs_updated_at
before update on public.sds_labs
for each row execute function public.sds_set_updated_at();

create or replace function public.sds_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sds_profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into public.sds_enrollments(user_id, course_id, term_name)
  select new.id, c.id, 'Ciclo II'
  from public.sds_courses c
  where c.active
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists sds_on_auth_user_created on auth.users;
create trigger sds_on_auth_user_created
after insert on auth.users
for each row execute function public.sds_handle_new_user();

create or replace function public.sds_bootstrap_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  insert into public.sds_profiles(id, display_name)
  select uid, coalesce(raw_user_meta_data->>'full_name', email)
  from auth.users
  where id = uid
  on conflict (id) do nothing;

  insert into public.sds_enrollments(user_id, course_id, term_name)
  select uid, c.id, 'Ciclo II'
  from public.sds_courses c
  where c.active
  on conflict do nothing;
end;
$$;

grant execute on function public.sds_bootstrap_current_user() to authenticated;

alter table public.sds_profiles enable row level security;
alter table public.sds_courses enable row level security;
alter table public.sds_enrollments enable row level security;
alter table public.sds_concepts enable row level security;
alter table public.sds_course_concepts enable row level security;
alter table public.sds_concept_dependencies enable row level security;
alter table public.sds_question_bank enable row level security;
alter table public.sds_learning_sessions enable row level security;
alter table public.sds_attempts enable row level security;
alter table public.sds_mastery_states enable row level security;
alter table public.sds_misconceptions enable row level security;
alter table public.sds_review_items enable row level security;
alter table public.sds_labs enable row level security;
alter table public.sds_artifacts enable row level security;
alter table public.sds_calendar_observations enable row level security;
alter table public.sds_learning_events enable row level security;

create policy "sds catalog courses read" on public.sds_courses
for select to authenticated using (true);
create policy "sds catalog concepts read" on public.sds_concepts
for select to authenticated using (true);
create policy "sds catalog course concepts read" on public.sds_course_concepts
for select to authenticated using (true);
create policy "sds catalog dependencies read" on public.sds_concept_dependencies
for select to authenticated using (true);
create policy "sds catalog questions read" on public.sds_question_bank
for select to authenticated using (active);

create policy "sds profile own" on public.sds_profiles
for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "sds enrollment own" on public.sds_enrollments
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds sessions own" on public.sds_learning_sessions
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds attempts own" on public.sds_attempts
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds mastery own" on public.sds_mastery_states
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds misconceptions own" on public.sds_misconceptions
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds reviews own" on public.sds_review_items
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds labs own" on public.sds_labs
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds artifacts own" on public.sds_artifacts
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds calendar own" on public.sds_calendar_observations
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sds events read own" on public.sds_learning_events
for select to authenticated using (user_id = auth.uid());
create policy "sds events insert own" on public.sds_learning_events
for insert to authenticated with check (user_id = auth.uid());
