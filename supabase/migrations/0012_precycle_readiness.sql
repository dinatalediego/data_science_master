-- SÓCRATES DS V1.5 — Pre-Cycle Readiness
-- Evidence-based launch readiness before the academic term.
-- No course is declared "ready" from passive completion or time spent alone.

create or replace function public.sds_precycle_course_readiness()
returns table (
  course_id uuid,
  course_slug text,
  course_name text,
  day_of_week integer,
  start_time time,
  concepts_total integer,
  concepts_with_evidence integer,
  attempts_total integer,
  available_questions integer,
  pending_reading_tasks integer,
  source_grounded_units integer,
  source_grounded_pending_tasks integer,
  has_schedule_conflict boolean,
  readiness_state text,
  next_step text
)
language sql
security definer
set search_path = public
as $$
with enrolled as (
  select c.*
  from public.sds_enrollments e
  join public.sds_courses c on c.id=e.course_id
  where e.user_id=auth.uid()
    and c.active
),
concepts as (
  select
    c.id as course_id,
    count(distinct cc.concept_id)::int as concepts_total,
    count(distinct cc.concept_id) filter (
      where ms.evidence_count > 0
    )::int as concepts_with_evidence
  from enrolled c
  left join public.sds_course_concepts cc on cc.course_id=c.id
  left join public.sds_mastery_states ms
    on ms.user_id=auth.uid()
   and ms.concept_id=cc.concept_id
  group by c.id
),
attempts as (
  select
    c.id as course_id,
    count(distinct a.id)::int as attempts_total,
    count(distinct q.id)::int as available_questions
  from enrolled c
  left join public.sds_question_bank q on q.course_id=c.id
  left join public.sds_attempts a
    on a.user_id=auth.uid()
   and a.question_id=q.id
  group by c.id
),
reading as (
  select
    c.id as course_id,
    count(distinct urt.id) filter (
      where urt.status in ('pending','in_progress')
    )::int as pending_reading_tasks,
    count(distinct ru.id) filter (
      where ru.grounding_status='source_grounded'
    )::int as source_grounded_units,
    count(distinct urt.id) filter (
      where ru.grounding_status='source_grounded'
        and urt.status in ('pending','in_progress')
    )::int as source_grounded_pending_tasks
  from enrolled c
  left join public.sds_reading_units ru
    on ru.course_id=c.id and ru.active
  left join public.sds_reading_task_templates rtt
    on rtt.reading_unit_id=ru.id and rtt.active
  left join public.sds_user_reading_tasks urt
    on urt.user_id=auth.uid()
   and urt.template_id=rtt.id
  group by c.id
)
select
  c.id,
  c.slug::text,
  c.name::text,
  c.day_of_week::integer,
  c.start_time,
  coalesce(k.concepts_total,0),
  coalesce(k.concepts_with_evidence,0),
  coalesce(a.attempts_total,0),
  coalesce(a.available_questions,0),
  coalesce(r.pending_reading_tasks,0),
  coalesce(r.source_grounded_units,0),
  coalesce(r.source_grounded_pending_tasks,0),
  (
    c.day_of_week=1
    and exists (
      select 1
      from enrolled other
      where other.id<>c.id
        and other.day_of_week=c.day_of_week
        and greatest(other.start_time,c.start_time) < least(other.end_time,c.end_time)
    )
  ) as has_schedule_conflict,
  case
    when coalesce(a.attempts_total,0)=0
      then 'baseline_missing'
    when coalesce(k.concepts_with_evidence,0)=0
      then 'attempt_without_concept_evidence'
    when coalesce(k.concepts_with_evidence,0) < least(2, greatest(coalesce(k.concepts_total,0),1))
      then 'early_evidence'
    when coalesce(r.source_grounded_pending_tasks,0)>0
      then 'foundation_open'
    else 'evidence_started'
  end::text as readiness_state,
  case
    when coalesce(a.attempts_total,0)=0 and coalesce(a.available_questions,0)>0
      then 'Produce una línea base cerrada: responde antes de mirar la guía y registra confianza.'
    when coalesce(r.source_grounded_pending_tasks,0)>0
      then 'Cierra una micro-misión source-grounded y termina con explicación o práctica.'
    when coalesce(a.attempts_total,0)=0
      then 'Aún falta una pregunta diagnóstica curada para este curso; usa Reading Room mientras se amplía el banco.'
    when coalesce(k.concepts_with_evidence,0)<2
      then 'Añade una segunda evidencia en un concepto distinto antes de ampliar contenido.'
    else 'Conserva la base y deja que Next-Best Action decida la siguiente intervención.'
  end::text as next_step
from enrolled c
left join concepts k on k.course_id=c.id
left join attempts a on a.course_id=c.id
left join reading r on r.course_id=c.id
order by
  case c.slug
    when 'forecasting-for-data-science' then 1
    when 'matematica-ml-ia' then 2
    when 'ml-supervisado-fundamentals' then 3
    when 'ml-supervisado-advanced' then 4
    when 'ml-no-supervisado' then 5
    when 'ciberseguridad-ia' then 6
    when 'proyecto-integrador-tesis' then 7
    else 99
  end;
$$;

grant execute on function public.sds_precycle_course_readiness() to authenticated;
