-- SÓCRATES DS V0.9 — persistent source-grounded Study Packs

create table if not exists public.sds_user_study_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_unit_id uuid not null references public.sds_reading_units(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  content jsonb not null default '{}'::jsonb,
  source_chunk_ids uuid[] not null default '{}',
  source_locators text[] not null default '{}',
  provider text not null default 'fallback',
  model text,
  grounding_status text not null default 'grounded'
    check (grounding_status in ('grounded','partial','insufficient')),
  generation_ms integer,
  created_at timestamptz not null default now(),
  unique(user_id, reading_unit_id, version)
);

create index if not exists sds_idx_user_study_packs_latest
  on public.sds_user_study_packs(user_id, reading_unit_id, version desc);

alter table public.sds_user_study_packs enable row level security;

drop policy if exists "sds study packs own" on public.sds_user_study_packs;
create policy "sds study packs own"
on public.sds_user_study_packs
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.sds_latest_study_pack(p_reading_unit_id uuid)
returns setof public.sds_user_study_packs
language sql
security invoker
set search_path = public
as $$
  select p.*
  from public.sds_user_study_packs p
  where p.user_id = auth.uid()
    and p.reading_unit_id = p_reading_unit_id
  order by p.version desc
  limit 1;
$$;

grant execute on function public.sds_latest_study_pack(uuid) to authenticated;
