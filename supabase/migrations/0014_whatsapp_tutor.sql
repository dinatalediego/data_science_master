-- SÓCRATES DS — scheduled WhatsApp learning tutor
-- Private learner data; server routes use the service role.

create table if not exists public.sds_whatsapp_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused')),
  daily_frequency smallint not null default 2
    check (daily_frequency between 0 and 3),
  consented_at timestamptz,
  pairing_code_hash text unique,
  pairing_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pairing_code_hash is null and pairing_code_expires_at is null)
    or (pairing_code_hash is not null and pairing_code_expires_at is not null))
);

create table if not exists public.sds_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  kind text not null check (kind in ('prompt', 'reply', 'feedback', 'system')),
  status text not null
    check (status in ('queued', 'sent', 'received', 'processing', 'answered', 'evaluated', 'failed', 'ignored')),
  body text not null,
  question_id uuid references public.sds_question_bank(id) on delete set null,
  concept_id uuid references public.sds_concepts(id) on delete set null,
  course_id uuid references public.sds_courses(id) on delete set null,
  attempt_id uuid references public.sds_attempts(id) on delete set null,
  in_reply_to_id uuid references public.sds_whatsapp_messages(id) on delete set null,
  meta_message_id text unique,
  idempotency_key text unique,
  processing_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sds_whatsapp_messages_user_created_idx
  on public.sds_whatsapp_messages (user_id, created_at desc);
create index if not exists sds_whatsapp_messages_pending_idx
  on public.sds_whatsapp_messages (status, created_at)
  where kind = 'reply' and status in ('received', 'processing');
create index if not exists sds_whatsapp_messages_unanswered_idx
  on public.sds_whatsapp_messages (user_id, created_at desc)
  where kind = 'prompt' and status = 'sent';

alter table public.sds_whatsapp_links enable row level security;
alter table public.sds_whatsapp_messages enable row level security;
revoke all on public.sds_whatsapp_links from anon, authenticated;
revoke all on public.sds_whatsapp_messages from anon, authenticated;
grant select on public.sds_whatsapp_links to authenticated;
grant select on public.sds_whatsapp_messages to authenticated;
grant all on public.sds_whatsapp_links to service_role;
grant all on public.sds_whatsapp_messages to service_role;

drop policy if exists "Learners can read their WhatsApp link" on public.sds_whatsapp_links;
create policy "Learners can read their WhatsApp link"
  on public.sds_whatsapp_links for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Learners can read their WhatsApp messages" on public.sds_whatsapp_messages;
create policy "Learners can read their WhatsApp messages"
  on public.sds_whatsapp_messages for select to authenticated
  using ((select auth.uid()) = user_id);

-- The learner's recurring target/predictor exercise, located by stable curriculum slugs.
insert into public.sds_question_bank (
  course_id, concept_id, mode, dimension, prompt, answer_guide, difficulty, active
)
select
  course.id,
  concept.id,
  'socratic'::public.sds_session_mode,
  'conceptual',
  'Un lead llega ahora y el equipo quiere priorizar a quién llamar. ¿Qué resultado futuro definirías como variable objetivo (y) y qué dos datos disponibles al crear el lead usarías como predictores (X)? Explica por qué ambos predictores ya existen en ese instante.',
  'Define un outcome observable y con horizonte temporal, por ejemplo conversión dentro de 30 días, como y. Propone dos atributos disponibles exactamente al crear el lead (por ejemplo canal, región, industria o tamaño de empresa) como X. No usa como predictor una conversión, llamada, estado o dato generado después de ese instante; distingue la etiqueta futura de la información disponible en producción.',
  2,
  true
from public.sds_courses course
join public.sds_concepts concept on concept.canonical_key = 'data-leakage'
where course.slug = 'ml-supervisado-fundamentals'
  and not exists (
    select 1 from public.sds_question_bank existing
    where existing.course_id = course.id
      and existing.concept_id = concept.id
      and existing.prompt like 'Un lead llega ahora y el equipo quiere priorizar a quién llamar.%'
  );
