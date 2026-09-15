-- SÓCRATES DS V1.7 — Curriculum Coverage & Source Gap Map
-- Distinguishes genuine source grounding from official-resource mappings.
-- Does not infer syllabus alignment from external-resource counts.

create or replace function public.sds_curriculum_coverage_map()
returns table (
  course_id uuid,
  course_slug text,
  course_name text,
  concepts_total integer,
  concepts_with_reading_map integer,
  concepts_missing integer,
  missing_concepts jsonb,
  reading_units integer,
  source_grounded_units integer,
  official_mapped_units integer,
  needs_syllabus_units integer,
  official_external_resources integer,
  source_grounded_concepts integer,
  official_mapped_concepts integer,
  coverage_state text,
  coverage_reason text,
  next_source_gap text
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
course_concept_set as (
  select c.id as course_id, cc.concept_id, x.title
  from enrolled c
  join public.sds_course_concepts cc on cc.course_id=c.id
  join public.sds_concepts x on x.id=cc.concept_id
),
visible_units as (
  select ru.*
  from public.sds_reading_units ru
  join enrolled c on c.id=ru.course_id
  where ru.active
    and (ru.owner_user_id is null or ru.owner_user_id=auth.uid())
),
unit_concepts as (
  select
    u.course_id,
    u.id as reading_unit_id,
    u.grounding_status,
    ruc.concept_id
  from visible_units u
  left join public.sds_reading_unit_concepts ruc
    on ruc.reading_unit_id=u.id
),
concept_stats as (
  select
    c.id as course_id,
    count(distinct ccs.concept_id)::int as concepts_total,
    count(distinct uc.concept_id) filter (
      where uc.concept_id=ccs.concept_id
    )::int as concepts_with_reading_map,
    count(distinct uc.concept_id) filter (
      where uc.concept_id=ccs.concept_id
        and uc.grounding_status='source_grounded'
    )::int as source_grounded_concepts,
    count(distinct uc.concept_id) filter (
      where uc.concept_id=ccs.concept_id
        and uc.grounding_status='official_resource_mapped'
    )::int as official_mapped_concepts
  from enrolled c
  left join course_concept_set ccs on ccs.course_id=c.id
  left join unit_concepts uc on uc.course_id=c.id
  group by c.id
),
missing as (
  select
    c.id as course_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'concept_id', ccs.concept_id,
          'title', ccs.title
        )
        order by ccs.title
      ) filter (
        where ccs.concept_id is not null
          and not exists (
            select 1
            from unit_concepts uc
            where uc.course_id=c.id
              and uc.concept_id=ccs.concept_id
          )
      ),
      '[]'::jsonb
    ) as missing_concepts
  from enrolled c
  left join course_concept_set ccs on ccs.course_id=c.id
  group by c.id
),
unit_stats as (
  select
    c.id as course_id,
    count(distinct u.id)::int as reading_units,
    count(distinct u.id) filter (
      where u.grounding_status='source_grounded'
    )::int as source_grounded_units,
    count(distinct u.id) filter (
      where u.grounding_status='official_resource_mapped'
    )::int as official_mapped_units,
    count(distinct u.id) filter (
      where u.grounding_status='needs_syllabus_alignment'
    )::int as needs_syllabus_units
  from enrolled c
  left join visible_units u on u.course_id=c.id
  group by c.id
),
external_stats as (
  select
    c.id as course_id,
    count(distinct erc.resource_id) filter (
      where er.official and er.active
    )::int as official_external_resources
  from enrolled c
  left join public.sds_external_resource_courses erc
    on erc.course_id=c.id
  left join public.sds_external_resources er
    on er.id=erc.resource_id
  group by c.id
)
select
  c.id,
  c.slug::text,
  c.name::text,
  coalesce(cs.concepts_total,0),
  coalesce(cs.concepts_with_reading_map,0),
  greatest(
    coalesce(cs.concepts_total,0)-coalesce(cs.concepts_with_reading_map,0),
    0
  )::int as concepts_missing,
  coalesce(m.missing_concepts,'[]'::jsonb),
  coalesce(us.reading_units,0),
  coalesce(us.source_grounded_units,0),
  coalesce(us.official_mapped_units,0),
  coalesce(us.needs_syllabus_units,0),
  coalesce(es.official_external_resources,0),
  coalesce(cs.source_grounded_concepts,0),
  coalesce(cs.official_mapped_concepts,0),
  case
    when coalesce(us.source_grounded_units,0)>=2
      then 'source_grounded_depth'
    when coalesce(us.source_grounded_units,0)=1
      then 'source_grounded_partial'
    when coalesce(us.official_mapped_units,0)>0
      then 'official_mapped_only'
    when coalesce(es.official_external_resources,0)>0
      then 'resource_only'
    else 'needs_source'
  end::text as coverage_state,
  case
    when coalesce(us.source_grounded_units,0)>=2
      and coalesce(cs.concepts_with_reading_map,0)=coalesce(cs.concepts_total,0)
      then 'Existe profundidad source-grounded para primeras semanas y todos los conceptos canónicos tienen al menos un vínculo de lectura. Esto no prueba cobertura del sílabo completo.'
    when coalesce(us.source_grounded_units,0)>=2
      then 'Existe profundidad source-grounded para primeras semanas, pero aún quedan conceptos canónicos sin ruta de lectura explícita.'
    when coalesce(us.source_grounded_units,0)=1
      then 'Existe una unidad source-grounded, pero todavía no hay suficiente profundidad para tratarla como ruta completa.'
    when coalesce(us.official_mapped_units,0)>0
      then 'Hay una ruta inicial basada en recursos oficiales externos. No equivale a lectura oficial del curso ni a alineación confirmada con el sílabo.'
    when coalesce(es.official_external_resources,0)>0
      then 'Hay recursos oficiales curados, pero aún no existe una Reading Mission explícita.'
    else 'No hay suficiente material curado para construir una ruta de lectura responsable.'
  end::text as coverage_reason,
  case
    when greatest(coalesce(cs.concepts_total,0)-coalesce(cs.concepts_with_reading_map,0),0)>0
      then (
        'Prioridad: aportar sílabo/reading o mapear fuente para '
        || greatest(coalesce(cs.concepts_total,0)-coalesce(cs.concepts_with_reading_map,0),0)::text
        || ' concepto(s) aún sin ruta explícita.'
      )
    when coalesce(us.source_grounded_units,0)=0 and coalesce(us.official_mapped_units,0)>0
      then 'Prioridad: aportar el sílabo, slides o lectura real del curso para convertir el benchmark oficial en una ruta source-grounded.'
    when coalesce(us.needs_syllabus_units,0)>0
      then 'Prioridad: confirmar la alineación de las unidades pendientes contra el sílabo real.'
    else 'Primeras semanas bien instrumentadas; profundizar solo cuando aparezca evidencia o material nuevo.'
  end::text as next_source_gap
from enrolled c
left join concept_stats cs on cs.course_id=c.id
left join missing m on m.course_id=c.id
left join unit_stats us on us.course_id=c.id
left join external_stats es on es.course_id=c.id
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

grant execute on function public.sds_curriculum_coverage_map() to authenticated;
