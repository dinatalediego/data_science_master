-- SÓCRATES DS V0.8 — private reading ingestion
-- User-owned PDF sources, private storage, ingestion observability and RLS isolation.

alter table public.sds_reading_sources
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists page_count integer,
  add column if not exists processing_status text not null default 'ready'
    check (processing_status in ('uploaded','processing','ready','failed')),
  add column if not exists processing_error text,
  add column if not exists source_hash text;

alter table public.sds_reading_units
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

create index if not exists sds_idx_reading_sources_owner
  on public.sds_reading_sources(owner_user_id, created_at desc);
create index if not exists sds_idx_reading_units_owner
  on public.sds_reading_units(owner_user_id, created_at desc);

create table if not exists public.sds_source_ingestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.sds_reading_sources(id) on delete cascade,
  storage_bucket text not null default 'sds-readings',
  storage_path text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','ready','failed')),
  page_count integer,
  chunk_count integer,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, storage_path)
);

create index if not exists sds_idx_source_ingestions_user_recent
  on public.sds_source_ingestions(user_id, created_at desc);

alter table public.sds_source_ingestions enable row level security;

drop policy if exists "sds source ingestions own" on public.sds_source_ingestions;
create policy "sds source ingestions own"
on public.sds_source_ingestions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Replace broad read policies with owner-aware rules.
drop policy if exists "sds reading sources read" on public.sds_reading_sources;
create policy "sds reading sources read"
on public.sds_reading_sources
for select to authenticated
using (active and (owner_user_id is null or owner_user_id = auth.uid()));

drop policy if exists "sds reading sources insert own" on public.sds_reading_sources;
create policy "sds reading sources insert own"
on public.sds_reading_sources
for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "sds reading sources update own" on public.sds_reading_sources;
create policy "sds reading sources update own"
on public.sds_reading_sources
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "sds reading sources delete own" on public.sds_reading_sources;
create policy "sds reading sources delete own"
on public.sds_reading_sources
for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "sds reading units read" on public.sds_reading_units;
create policy "sds reading units read"
on public.sds_reading_units
for select to authenticated
using (active and (owner_user_id is null or owner_user_id = auth.uid()));

drop policy if exists "sds reading units insert own" on public.sds_reading_units;
create policy "sds reading units insert own"
on public.sds_reading_units
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and source_id is not null
  and exists (
    select 1 from public.sds_reading_sources s
    where s.id = source_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "sds reading units update own" on public.sds_reading_units;
create policy "sds reading units update own"
on public.sds_reading_units
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "sds reading units delete own" on public.sds_reading_units;
create policy "sds reading units delete own"
on public.sds_reading_units
for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "sds source chunks read" on public.sds_source_chunks;
create policy "sds source chunks read"
on public.sds_source_chunks
for select to authenticated
using (
  exists (
    select 1 from public.sds_reading_sources s
    where s.id = source_id
      and (s.owner_user_id is null or s.owner_user_id = auth.uid())
  )
);

drop policy if exists "sds source chunks insert own" on public.sds_source_chunks;
create policy "sds source chunks insert own"
on public.sds_source_chunks
for insert to authenticated
with check (
  exists (
    select 1 from public.sds_reading_sources s
    where s.id = source_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "sds source chunks update own" on public.sds_source_chunks;
create policy "sds source chunks update own"
on public.sds_source_chunks
for update to authenticated
using (
  exists (
    select 1 from public.sds_reading_sources s
    where s.id = source_id and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.sds_reading_sources s
    where s.id = source_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "sds source chunks delete own" on public.sds_source_chunks;
create policy "sds source chunks delete own"
on public.sds_source_chunks
for delete to authenticated
using (
  exists (
    select 1 from public.sds_reading_sources s
    where s.id = source_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "sds reading artifacts read" on public.sds_reading_artifacts;
create policy "sds reading artifacts read"
on public.sds_reading_artifacts
for select to authenticated
using (
  active and exists (
    select 1 from public.sds_reading_units u
    where u.id = reading_unit_id
      and (u.owner_user_id is null or u.owner_user_id = auth.uid())
  )
);

drop policy if exists "sds reading artifacts insert own" on public.sds_reading_artifacts;
create policy "sds reading artifacts insert own"
on public.sds_reading_artifacts
for insert to authenticated
with check (
  exists (
    select 1 from public.sds_reading_units u
    where u.id = reading_unit_id and u.owner_user_id = auth.uid()
  )
);

drop policy if exists "sds reading task templates read" on public.sds_reading_task_templates;
create policy "sds reading task templates read"
on public.sds_reading_task_templates
for select to authenticated
using (
  active and exists (
    select 1 from public.sds_reading_units u
    where u.id = reading_unit_id
      and (u.owner_user_id is null or u.owner_user_id = auth.uid())
  )
);

drop policy if exists "sds reading task templates insert own" on public.sds_reading_task_templates;
create policy "sds reading task templates insert own"
on public.sds_reading_task_templates
for insert to authenticated
with check (
  exists (
    select 1 from public.sds_reading_units u
    where u.id = reading_unit_id and u.owner_user_id = auth.uid()
  )
);

drop policy if exists "sds reading unit concepts read" on public.sds_reading_unit_concepts;
create policy "sds reading unit concepts read"
on public.sds_reading_unit_concepts
for select to authenticated
using (
  exists (
    select 1 from public.sds_reading_units u
    where u.id = reading_unit_id
      and (u.owner_user_id is null or u.owner_user_id = auth.uid())
  )
);

drop policy if exists "sds reading unit concepts insert own" on public.sds_reading_unit_concepts;
create policy "sds reading unit concepts insert own"
on public.sds_reading_unit_concepts
for insert to authenticated
with check (
  exists (
    select 1 from public.sds_reading_units u
    where u.id = reading_unit_id and u.owner_user_id = auth.uid()
  )
);

-- Private Storage bucket. Object names are always <auth.uid()>/<uuid>-filename.pdf.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'sds-readings',
  'sds-readings',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "sds private readings select own" on storage.objects;
create policy "sds private readings select own"
on storage.objects
for select to authenticated
using (
  bucket_id = 'sds-readings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "sds private readings insert own" on storage.objects;
create policy "sds private readings insert own"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'sds-readings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "sds private readings update own" on storage.objects;
create policy "sds private readings update own"
on storage.objects
for update to authenticated
using (
  bucket_id = 'sds-readings'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'sds-readings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "sds private readings delete own" on storage.objects;
create policy "sds private readings delete own"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'sds-readings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Ensure task bootstrapping never leaks another user's private reading.
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
  where t.active
    and u.active
    and (u.owner_user_id is null or u.owner_user_id = uid)
  on conflict (user_id, template_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.sds_bootstrap_reading_tasks() to authenticated;
