-- SÓCRATES DS V0.1 — Supabase foundation
-- This migration defines the first persistence contract for the personal learning campus.

create extension if not exists pgcrypto;

do $$ begin
  create type public.session_mode as enum ('socratic','professor','feynman','examiner','coach','debugger','researcher','thesis_advisor','devils_advocate','practice','review','lab');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.learning_stage as enum ('seen','recalled','explained','solved','applied','transferred','mastered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('scheduled','attended','partial','missed','catch_up_planned','caught_up','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.misconception_status as enum ('open','improving','resolved','reopened');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('due','scheduled','completed','skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.resource_kind as enum ('slides','pdf','paper','video','book','note','notebook','dataset','link','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.artifact_kind as enum ('notebook','report','derivation','explanation','model','model_card','presentation','thesis_section','other');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Lima',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  instructor text,
  credits smallint check (credits is null or credits > 0),
  academic_hours smallint check (academic_hours is null or academic_hours > 0),
  day_of_week smallint check (day_of_week between 1 and 7),
  start_time time,
  end_time time,
  learning_role text,
  color_token text,
  source_status text not null default 'unknown',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time)
);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  term_name text not null default 'Ciclo II',
  enrolled_at timestamptz not null default now(),
  unique(user_id, course_id, term_name)
);

create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  week_number smallint check (week_number between 1 and 18),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text,
  official boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.course_session_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  status public.attendance_status not null default 'scheduled',
  notes text,
  catch_up_due_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, session_id)
);

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  title text not null,
  description text,
  difficulty smallint check (difficulty between 1 and 5),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_concepts (
  course_id uuid not null references public.courses(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  role text not null default 'core',
  module text,
  primary key(course_id, concept_id)
);

create table if not exists public.concept_dependencies (
  prerequisite_concept_id uuid not null references public.concepts(id) on delete cascade,
  dependent_concept_id uuid not null references public.concepts(id) on delete cascade,
  strength numeric(4,3) not null default 1.0 check (strength > 0 and strength <= 1),
  rationale text,
  primary key(prerequisite_concept_id, dependent_concept_id),
  check (prerequisite_concept_id <> dependent_concept_id)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  kind public.resource_kind not null default 'other',
  url text,
  storage_path text,
  source_type text not null default 'personal' check (source_type in ('official','generated','personal','external')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);

create table if not exists public.resource_concepts (
  resource_id uuid not null references public.resources(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  primary key(resource_id, concept_id)
);

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  mode public.session_mode not null,
  goal text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_minutes integer check (planned_minutes is null or planned_minutes > 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  reflection text,
  metadata jsonb not null default '{}'::jsonb,
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  assessment_type text not null default 'practice',
  source_type text not null default 'generated' check (source_type in ('official','generated','personal')),
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  prompt text not null,
  question_type text not null default 'open',
  rubric jsonb not null default '{}'::jsonb,
  max_score numeric(8,3) not null default 1 check (max_score > 0),
  position integer not null default 1 check (position > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.question_concepts (
  question_id uuid not null references public.questions(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  dimension text not null default 'conceptual' check (dimension in ('conceptual','mathematical','coding','transfer','retention')),
  weight numeric(5,4) not null default 1 check (weight > 0),
  primary key(question_id, concept_id, dimension)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  learning_session_id uuid references public.learning_sessions(id) on delete set null,
  response_text text,
  score numeric(8,3),
  max_score numeric(8,3),
  is_correct boolean,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  feedback text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (score is null or score >= 0),
  check (max_score is null or max_score > 0),
  check (score is null or max_score is null or score <= max_score)
);

create table if not exists public.mastery_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  stage public.learning_stage not null default 'seen',
  conceptual numeric(5,4) check (conceptual is null or (conceptual between 0 and 1)),
  mathematical numeric(5,4) check (mathematical is null or (mathematical between 0 and 1)),
  coding numeric(5,4) check (coding is null or (coding between 0 and 1)),
  transfer numeric(5,4) check (transfer is null or (transfer between 0 and 1)),
  retention numeric(5,4) check (retention is null or (retention between 0 and 1)),
  confidence numeric(5,4) check (confidence is null or (confidence between 0 and 1)),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  last_evidence_at timestamptz,
  next_review_at timestamptz,
  explanation jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, concept_id)
);

create table if not exists public.misconceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  title text not null,
  description text,
  status public.misconception_status not null default 'open',
  severity smallint not null default 2 check (severity between 1 and 5),
  evidence_count integer not null default 1 check (evidence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  source_attempt_id uuid references public.attempts(id) on delete set null,
  due_at timestamptz not null,
  interval_days numeric(8,2) not null default 1 check (interval_days > 0),
  ease_factor numeric(5,3) not null default 2.5 check (ease_factor > 0),
  reason text,
  status public.review_status not null default 'scheduled',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned','in_progress','blocked','completed','reviewed')),
  repo_path text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_concepts (
  lab_id uuid not null references public.labs(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  primary key(lab_id, concept_id)
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  lab_id uuid references public.labs(id) on delete set null,
  title text not null,
  kind public.artifact_kind not null default 'other',
  uri text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.artifact_concepts (
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  evidence_dimension text check (evidence_dimension is null or evidence_dimension in ('conceptual','mathematical','coding','transfer','retention')),
  primary key(artifact_id, concept_id)
);

create table if not exists public.learning_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  concept_id uuid references public.concepts(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_course_sessions_course_start on public.course_sessions(course_id, starts_at);
create index if not exists idx_learning_sessions_user_start on public.learning_sessions(user_id, started_at desc);
create index if not exists idx_attempts_user_created on public.attempts(user_id, created_at desc);
create index if not exists idx_mastery_user_review on public.mastery_states(user_id, next_review_at);
create index if not exists idx_misconceptions_user_status on public.misconceptions(user_id, status);
create index if not exists idx_review_items_user_due on public.review_items(user_id, due_at) where status in ('due','scheduled');
create index if not exists idx_learning_events_user_time on public.learning_events(user_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
drop trigger if exists trg_attendance_updated_at on public.course_session_attendance;
create trigger trg_attendance_updated_at before update on public.course_session_attendance for each row execute function public.set_updated_at();
drop trigger if exists trg_concepts_updated_at on public.concepts;
create trigger trg_concepts_updated_at before update on public.concepts for each row execute function public.set_updated_at();
drop trigger if exists trg_mastery_updated_at on public.mastery_states;
create trigger trg_mastery_updated_at before update on public.mastery_states for each row execute function public.set_updated_at();
drop trigger if exists trg_labs_updated_at on public.labs;
create trigger trg_labs_updated_at before update on public.labs for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_sessions enable row level security;
alter table public.course_session_attendance enable row level security;
alter table public.concepts enable row level security;
alter table public.course_concepts enable row level security;
alter table public.concept_dependencies enable row level security;
alter table public.resources enable row level security;
alter table public.resource_concepts enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.question_concepts enable row level security;
alter table public.attempts enable row level security;
alter table public.mastery_states enable row level security;
alter table public.misconceptions enable row level security;
alter table public.review_items enable row level security;
alter table public.labs enable row level security;
alter table public.lab_concepts enable row level security;
alter table public.artifacts enable row level security;
alter table public.artifact_concepts enable row level security;
alter table public.learning_events enable row level security;

-- Shared catalog: authenticated read only from client.
create policy "authenticated can read courses" on public.courses for select to authenticated using (true);
create policy "authenticated can read course sessions" on public.course_sessions for select to authenticated using (true);
create policy "authenticated can read concepts" on public.concepts for select to authenticated using (true);
create policy "authenticated can read course concepts" on public.course_concepts for select to authenticated using (true);
create policy "authenticated can read concept dependencies" on public.concept_dependencies for select to authenticated using (true);

-- Direct user-owned tables.
create policy "profiles own row" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "enrollments own rows" on public.course_enrollments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attendance own rows" on public.course_session_attendance for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resources own rows" on public.resources for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning sessions own rows" on public.learning_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assessments own rows" on public.assessments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts own rows" on public.attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mastery own rows" on public.mastery_states for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "misconceptions own rows" on public.misconceptions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews own rows" on public.review_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "labs own rows" on public.labs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "artifacts own rows" on public.artifacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning events own rows" on public.learning_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child-table policies inherit ownership from their parent.
create policy "resource concepts by resource owner" on public.resource_concepts for all to authenticated
using (exists (select 1 from public.resources r where r.id = resource_id and r.user_id = auth.uid()))
with check (exists (select 1 from public.resources r where r.id = resource_id and r.user_id = auth.uid()));

create policy "questions by assessment owner" on public.questions for all to authenticated
using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

create policy "question concepts by assessment owner" on public.question_concepts for all to authenticated
using (exists (select 1 from public.questions q join public.assessments a on a.id = q.assessment_id where q.id = question_id and a.user_id = auth.uid()))
with check (exists (select 1 from public.questions q join public.assessments a on a.id = q.assessment_id where q.id = question_id and a.user_id = auth.uid()));

create policy "lab concepts by lab owner" on public.lab_concepts for all to authenticated
using (exists (select 1 from public.labs l where l.id = lab_id and l.user_id = auth.uid()))
with check (exists (select 1 from public.labs l where l.id = lab_id and l.user_id = auth.uid()));

create policy "artifact concepts by artifact owner" on public.artifact_concepts for all to authenticated
using (exists (select 1 from public.artifacts a where a.id = artifact_id and a.user_id = auth.uid()))
with check (exists (select 1 from public.artifacts a where a.id = artifact_id and a.user_id = auth.uid()));

-- Learning events are append-first telemetry. Client deletion is intentionally not granted.
drop policy if exists "learning events own rows" on public.learning_events;
create policy "learning events read own" on public.learning_events for select to authenticated using (auth.uid() = user_id);
create policy "learning events insert own" on public.learning_events for insert to authenticated with check (auth.uid() = user_id);
