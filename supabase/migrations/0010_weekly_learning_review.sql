-- SÓCRATES DS V1.3 — Weekly Learning Review + observational outcome ledger
-- Weekly boundaries use America/Lima. Metrics remain evidence-based and sparse-data safe.

create or replace function public.sds_week_bounds(p_week_start date default null)
returns table (
  week_start date,
  week_end date,
  start_at timestamptz,
  end_at timestamptz
)
language sql
stable
as $$
  select
    coalesce(
      p_week_start,
      date_trunc('week', now() at time zone 'America/Lima')::date
    ) as week_start,
    coalesce(
      p_week_start,
      date_trunc('week', now() at time zone 'America/Lima')::date
    ) + 6 as week_end,
    (
      coalesce(
        p_week_start,
        date_trunc('week', now() at time zone 'America/Lima')::date
      )::timestamp
      at time zone 'America/Lima'
    ) as start_at,
    (
      (
        coalesce(
          p_week_start,
          date_trunc('week', now() at time zone 'America/Lima')::date
        ) + 7
      )::timestamp
      at time zone 'America/Lima'
    ) as end_at;
$$;

grant execute on function public.sds_week_bounds(date) to authenticated;

create or replace function public.sds_weekly_learning_snapshot(
  p_week_start date default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
with
b as (
  select * from public.sds_week_bounds(p_week_start)
),
sessions as (
  select
    count(*)::integer as n,
    coalesce(sum(planned_minutes),0)::integer as planned_minutes
  from public.sds_learning_sessions s, b
  where s.user_id=auth.uid()
    and s.started_at >= b.start_at
    and s.started_at < b.end_at
),
scores as (
  select s.*
  from public.sds_attempt_effective_scores() s, b
  where s.attempt_created_at >= b.start_at
    and s.attempt_created_at < b.end_at
),
attempt_metrics as (
  select
    count(*)::integer as attempts,
    count(*) filter (where score_source='evaluator')::integer as evaluated_attempts,
    count(distinct concept_id)::integer as concepts_touched,
    round(avg(confidence)::numeric,3) as avg_confidence,
    round(avg(effective_score)::numeric,3) as avg_performance,
    round(avg(abs(confidence-effective_score))::numeric,3) as avg_abs_gap
  from scores
),
reading_metrics as (
  select count(*)::integer as completed
  from public.sds_user_reading_tasks t, b
  where t.user_id=auth.uid()
    and t.status='completed'
    and t.completed_at >= b.start_at
    and t.completed_at < b.end_at
),
review_metrics as (
  select count(*)::integer as completed
  from public.sds_review_items r, b
  where r.user_id=auth.uid()
    and r.status='completed'
    and r.completed_at >= b.start_at
    and r.completed_at < b.end_at
),
action_metrics as (
  select
    count(*) filter (where event_type='opened')::integer as opened,
    count(*) filter (where event_type='completed')::integer as completed,
    count(*) filter (where event_type='dismissed')::integer as snoozed
  from public.sds_learning_action_events e, b
  where e.user_id=auth.uid()
    and e.created_at >= b.start_at
    and e.created_at < b.end_at
),
courses_touched as (
  select count(distinct course_id)::integer as n
  from (
    select s.course_id
    from public.sds_learning_sessions s, b
    where s.user_id=auth.uid()
      and s.course_id is not null
      and s.started_at >= b.start_at
      and s.started_at < b.end_at

    union all

    select u.course_id
    from public.sds_user_reading_tasks t
    join public.sds_reading_task_templates tt on tt.id=t.template_id
    join public.sds_reading_units u on u.id=tt.reading_unit_id
    cross join b
    where t.user_id=auth.uid()
      and t.status='completed'
      and t.completed_at >= b.start_at
      and t.completed_at < b.end_at
  ) x
),
backlog as (
  select
    (select count(*)::integer
     from public.sds_user_reading_tasks t
     where t.user_id=auth.uid()
       and t.status in ('pending','in_progress')) as pending_readings,

    (select count(*)::integer
     from public.sds_review_items r
     where r.user_id=auth.uid()
       and r.status in ('scheduled','due')
       and r.due_at <= now()) as due_reviews,

    (select count(*)::integer
     from public.sds_misconceptions m
     where m.user_id=auth.uid()
       and m.status in ('open','improving','reopened')) as open_misconceptions
),
metrics as (
  select
    b.week_start,
    b.week_end,
    s.n as sessions,
    s.planned_minutes,
    a.attempts,
    a.evaluated_attempts,
    case
      when a.attempts > 0
        then round((a.evaluated_attempts::numeric/a.attempts),3)
      else 0
    end as evaluator_coverage,
    a.concepts_touched,
    coalesce(a.avg_confidence,0) as avg_confidence,
    coalesce(a.avg_performance,0) as avg_performance,
    coalesce(a.avg_abs_gap,0) as avg_abs_gap,
    rm.completed as reading_tasks_completed,
    rv.completed as reviews_completed,
    am.opened as actions_opened,
    am.completed as actions_completed,
    am.snoozed as actions_snoozed,
    ct.n as courses_touched,
    bl.pending_readings,
    bl.due_reviews,
    bl.open_misconceptions
  from b
  cross join sessions s
  cross join attempt_metrics a
  cross join reading_metrics rm
  cross join review_metrics rv
  cross join action_metrics am
  cross join courses_touched ct
  cross join backlog bl
)
select jsonb_build_object(
  'week_start', week_start,
  'week_end', week_end,
  'timezone', 'America/Lima',
  'sessions', sessions,
  'planned_minutes', planned_minutes,
  'attempts', attempts,
  'evaluated_attempts', evaluated_attempts,
  'evaluator_coverage', evaluator_coverage,
  'concepts_touched', concepts_touched,
  'courses_touched', courses_touched,
  'avg_confidence', avg_confidence,
  'avg_performance', avg_performance,
  'avg_absolute_calibration_gap', avg_abs_gap,
  'reading_tasks_completed', reading_tasks_completed,
  'reviews_completed', reviews_completed,
  'actions_opened', actions_opened,
  'actions_completed', actions_completed,
  'actions_snoozed', actions_snoozed,
  'pending_readings', pending_readings,
  'due_reviews', due_reviews,
  'open_misconceptions', open_misconceptions,

  'stop_doing',
    case
      when actions_snoozed >= 3
        then 'Deja de acumular postergaciones grandes. Elige una sola misión de rescate de 10 minutos.'
      when reading_tasks_completed >= 3 and attempts = 0
        then 'Deja de cerrar lecturas sin producir recuperación o resolución. Convierte una lectura en evidencia.'
      when attempts >= 3 and reviews_completed = 0 and due_reviews > 0
        then 'Deja de añadir intentos nuevos mientras la cola de retrieval siga vencida.'
      else 'No hay suficiente evidencia semanal para recomendar un “stop doing” específico.'
    end,

  'start_doing',
    case
      when attempts = 0
        then 'Produce al menos dos intentos cerrados esta semana para crear una línea base de evidencia.'
      when due_reviews > 0 and reviews_completed = 0
        then 'Empieza por una revisión vencida antes de consumir contenido nuevo.'
      when attempts > 0 and evaluator_coverage < 0.50
        then 'Prioriza preguntas con guía explícita para aumentar cobertura de contraste independiente.'
      when avg_abs_gap >= 0.20
        then 'Haz una sesión Examiner sobre el concepto con mayor gap entre confianza y evidencia.'
      else 'Elige la primera intervención priorizada y conviértela en evidencia observable.'
    end,

  'continue_doing',
    case
      when reviews_completed > 0
        then 'Mantén retrieval espaciado: ya hay revisiones completadas esta semana.'
      when attempts > 0
        then 'Mantén la práctica con respuesta propia antes de mirar la guía.'
      when reading_tasks_completed > 0
        then 'Mantén la lectura activa, pero añade explicación cerrada y práctica.'
      else 'Primero crea evidencia; todavía no hay una conducta semanal suficientemente observada para reforzar.'
    end
)
from metrics;
$$;

grant execute on function public.sds_weekly_learning_snapshot(date) to authenticated;

create or replace function public.sds_weekly_course_evidence(
  p_week_start date default null
)
returns table (
  course_id uuid,
  course_name text,
  sessions integer,
  planned_minutes integer,
  attempts integer,
  reading_tasks_completed integer,
  concepts_touched integer
)
language sql
security definer
set search_path = public
as $$
with
b as (
  select * from public.sds_week_bounds(p_week_start)
),
session_stats as (
  select
    s.course_id,
    count(*)::integer as sessions,
    coalesce(sum(s.planned_minutes),0)::integer as planned_minutes
  from public.sds_learning_sessions s, b
  where s.user_id=auth.uid()
    and s.course_id is not null
    and s.started_at >= b.start_at
    and s.started_at < b.end_at
  group by s.course_id
),
attempt_stats as (
  select
    ls.course_id,
    count(a.id)::integer as attempts,
    count(distinct a.concept_id)::integer as concepts_touched
  from public.sds_attempts a
  join public.sds_learning_sessions ls on ls.id=a.session_id
  cross join b
  where a.user_id=auth.uid()
    and a.created_at >= b.start_at
    and a.created_at < b.end_at
  group by ls.course_id
),
reading_stats as (
  select
    u.course_id,
    count(*)::integer as reading_tasks_completed
  from public.sds_user_reading_tasks t
  join public.sds_reading_task_templates tt on tt.id=t.template_id
  join public.sds_reading_units u on u.id=tt.reading_unit_id
  cross join b
  where t.user_id=auth.uid()
    and t.status='completed'
    and t.completed_at >= b.start_at
    and t.completed_at < b.end_at
  group by u.course_id
)
select
  c.id,
  c.name::text,
  coalesce(ss.sessions,0)::integer,
  coalesce(ss.planned_minutes,0)::integer,
  coalesce(ast.attempts,0)::integer,
  coalesce(rs.reading_tasks_completed,0)::integer,
  coalesce(ast.concepts_touched,0)::integer
from public.sds_enrollments e
join public.sds_courses c on c.id=e.course_id and c.active
left join session_stats ss on ss.course_id=c.id
left join attempt_stats ast on ast.course_id=c.id
left join reading_stats rs on rs.course_id=c.id
where e.user_id=auth.uid()
order by c.day_of_week,c.start_time,c.name;
$$;

grant execute on function public.sds_weekly_course_evidence(date) to authenticated;

create or replace function public.sds_weekly_learning_history(
  p_weeks integer default 8
)
returns table (
  week_start date,
  week_end date,
  attempts integer,
  evaluated_attempts integer,
  reading_tasks_completed integer,
  reviews_completed integer,
  actions_completed integer,
  actions_snoozed integer,
  planned_minutes integer,
  avg_confidence numeric,
  avg_performance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weeks integer := greatest(1, least(coalesce(p_weeks,8),26));
  v_current date := date_trunc('week', now() at time zone 'America/Lima')::date;
  v_start date;
  v_snapshot jsonb;
  i integer;
begin
  for i in 0..(v_weeks-1) loop
    v_start := v_current - (i * 7);
    v_snapshot := public.sds_weekly_learning_snapshot(v_start);

    week_start := (v_snapshot->>'week_start')::date;
    week_end := (v_snapshot->>'week_end')::date;
    attempts := coalesce((v_snapshot->>'attempts')::integer,0);
    evaluated_attempts := coalesce((v_snapshot->>'evaluated_attempts')::integer,0);
    reading_tasks_completed := coalesce((v_snapshot->>'reading_tasks_completed')::integer,0);
    reviews_completed := coalesce((v_snapshot->>'reviews_completed')::integer,0);
    actions_completed := coalesce((v_snapshot->>'actions_completed')::integer,0);
    actions_snoozed := coalesce((v_snapshot->>'actions_snoozed')::integer,0);
    planned_minutes := coalesce((v_snapshot->>'planned_minutes')::integer,0);
    avg_confidence := coalesce((v_snapshot->>'avg_confidence')::numeric,0);
    avg_performance := coalesce((v_snapshot->>'avg_performance')::numeric,0);

    return next;
  end loop;
end;
$$;

grant execute on function public.sds_weekly_learning_history(integer) to authenticated;

create or replace function public.sds_intervention_outcomes(
  p_days integer default 90
)
returns table (
  action_event_id uuid,
  action_type text,
  concept_id uuid,
  concept_title text,
  intervention_completed_at timestamptz,
  pre_attempt_id uuid,
  pre_score numeric,
  pre_score_source text,
  pre_attempt_at timestamptz,
  post_attempt_id uuid,
  post_score numeric,
  post_score_source text,
  post_attempt_at timestamptz,
  observed_delta numeric,
  outcome_status text
)
language sql
security definer
set search_path = public
as $$
with
events as (
  select
    e.id,
    e.action_type,
    e.created_at,
    case
      when coalesce(e.metadata->>'concept_id','')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (e.metadata->>'concept_id')::uuid
      else null
    end as concept_id
  from public.sds_learning_action_events e
  where e.user_id=auth.uid()
    and e.event_type='completed'
    and e.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days,90),365)))
),
scores as (
  select * from public.sds_attempt_effective_scores()
)
select
  ev.id as action_event_id,
  ev.action_type::text,
  ev.concept_id,
  c.title::text,
  ev.created_at as intervention_completed_at,
  pre.attempt_id as pre_attempt_id,
  pre.effective_score as pre_score,
  pre.score_source::text as pre_score_source,
  pre.attempt_created_at as pre_attempt_at,
  post.attempt_id as post_attempt_id,
  post.effective_score as post_score,
  post.score_source::text as post_score_source,
  post.attempt_created_at as post_attempt_at,
  case
    when pre.attempt_id is not null and post.attempt_id is not null
      then round((post.effective_score-pre.effective_score)::numeric,3)
    else null
  end as observed_delta,
  case
    when pre.attempt_id is not null and post.attempt_id is not null then 'paired'
    when post.attempt_id is not null then 'post_only'
    else 'no_post_evidence'
  end::text as outcome_status
from events ev
left join public.sds_concepts c on c.id=ev.concept_id
left join lateral (
  select s.*
  from scores s
  where s.concept_id=ev.concept_id
    and s.attempt_created_at <= ev.created_at + interval '5 minutes'
    and s.attempt_created_at >= ev.created_at - interval '1 day'
  order by s.attempt_created_at desc
  limit 1
) post on true
left join lateral (
  select s.*
  from scores s
  where s.concept_id=ev.concept_id
    and post.attempt_id is not null
    and s.attempt_created_at < post.attempt_created_at
  order by s.attempt_created_at desc
  limit 1
) pre on true
where ev.concept_id is not null
order by ev.created_at desc;
$$;

grant execute on function public.sds_intervention_outcomes(integer) to authenticated;
