-- SÓCRATES DS V0.3 — Ivy+ / elite learning library
-- Stores metadata and links only. Original learning materials remain hosted by
-- their universities and are subject to the source site's terms and licenses.

create table if not exists public.sds_external_resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  institution text not null,
  course_code text,
  course_title text not null,
  title text not null,
  description text not null,
  url text not null,
  resource_type text not null
    check (resource_type in (
      'open_course','course_materials','lecture_notes','tutorial',
      'project_guide','benchmark_syllabus','open_program'
    )),
  access_type text not null
    check (access_type in ('open_full','free','free_audit','benchmark_only')),
  level text not null default 'intermediate'
    check (level in ('foundation','intermediate','advanced','graduate')),
  provider text not null,
  source_year text,
  learning_role text not null,
  license_note text,
  official boolean not null default true,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sds_external_resource_courses (
  resource_id uuid not null references public.sds_external_resources(id) on delete cascade,
  course_id uuid not null references public.sds_courses(id) on delete cascade,
  priority smallint not null default 2 check (priority between 1 and 3),
  role text not null default 'recommended'
    check (role in ('core','recommended','extension','benchmark')),
  rationale text not null,
  primary key (resource_id, course_id)
);

create table if not exists public.sds_external_resource_concepts (
  resource_id uuid not null references public.sds_external_resources(id) on delete cascade,
  concept_id uuid not null references public.sds_concepts(id) on delete cascade,
  relevance smallint not null default 3 check (relevance between 1 and 5),
  primary key (resource_id, concept_id)
);

create index if not exists sds_idx_external_resources_institution
  on public.sds_external_resources(institution, active);
create index if not exists sds_idx_external_resource_courses_course
  on public.sds_external_resource_courses(course_id, priority);
create index if not exists sds_idx_external_resource_concepts_concept
  on public.sds_external_resource_concepts(concept_id, relevance desc);

drop trigger if exists sds_external_resources_updated_at on public.sds_external_resources;
create trigger sds_external_resources_updated_at
before update on public.sds_external_resources
for each row execute function public.sds_set_updated_at();

alter table public.sds_external_resources enable row level security;
alter table public.sds_external_resource_courses enable row level security;
alter table public.sds_external_resource_concepts enable row level security;

create policy "sds official resources read"
on public.sds_external_resources
for select to authenticated
using (active and official);

create policy "sds resource course map read"
on public.sds_external_resource_courses
for select to authenticated
using (true);

create policy "sds resource concept map read"
on public.sds_external_resource_concepts
for select to authenticated
using (true);
