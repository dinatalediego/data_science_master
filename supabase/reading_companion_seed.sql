-- SÓCRATES DS V0.6 — Reading Companion initial curriculum
-- Derivative study aids only: no copied textbook passages are stored.

insert into public.sds_reading_sources
  (slug, title, author, institution_or_publisher, publication_year, source_kind, external_url, access_note, citation_note)
values
  (
    'hamilton-time-series-analysis',
    'Time Series Analysis',
    'James D. Hamilton',
    'Princeton University Press',
    1994,
    'uploaded_book',
    null,
    'User-provided copy. SÓCRATES stores locators and original study aids, not reproduced textbook pages.',
    'Hamilton, James D. Time Series Analysis. Princeton University Press, 1994.'
  ),
  (
    'strang-linear-algebra-learning-data',
    'Linear Algebra and Learning from Data',
    'Gilbert Strang',
    'Wellesley-Cambridge Press',
    2019,
    'uploaded_book',
    null,
    'User-provided copy. SÓCRATES stores locators and original study aids, not reproduced textbook pages.',
    'Strang, Gilbert. Linear Algebra and Learning from Data. Wellesley-Cambridge Press, 2019.'
  ),
  (
    'mit-14384-lecture1',
    'Stationarity, Lag Operator, ARMA, and Covariance Structure',
    'Anna Mikusheva; Paul Schrimpf (scribe)',
    'MIT OpenCourseWare — 14.384 Time Series Analysis',
    2009,
    'uploaded_note',
    'https://ocw.mit.edu/courses/14-384-time-series-analysis-fall-2013/',
    'MIT OpenCourseWare lecture note supplied by the user.',
    'MIT 14.384 Time Series Analysis, Lecture 1.'
  )
on conflict (slug) do update set
  title = excluded.title,
  author = excluded.author,
  institution_or_publisher = excluded.institution_or_publisher,
  publication_year = excluded.publication_year,
  source_kind = excluded.source_kind,
  external_url = excluded.external_url,
  access_note = excluded.access_note,
  citation_note = excluded.citation_note,
  active = true;

-- Source-grounded routes from the uploaded readings.
insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'forecasting-dependence-stationarity',
  c.id, s.id, 'Semana 1', 1,
  'Dependencia, estacionariedad y qué hace especial a una serie de tiempo',
  'MIT 14.384 Lecture 1, pp. 1–2',
  'Distinguir dependencia temporal, ruido blanco, estacionariedad estricta y estacionariedad débil.',
  'Sin una noción de estabilidad no puedes justificar inferencia ni forecast. Esta unidad crea el lenguaje base del curso.',
  45, 3, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='forecasting-for-data-science' and s.slug='mit-14384-lecture1'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'forecasting-lag-operator',
  c.id, s.id, 'Semana 1–2', 2,
  'Lag operator y ecuaciones en diferencias',
  'Hamilton, Chapter 2: Lag Operators, pp. 25–42',
  'Manipular polinomios en L, conectar raíces con estabilidad y leer una dinámica temporal como una ecuación algebraica.',
  'El lag operator convierte muchas derivaciones de series de tiempo en álgebra manejable y prepara ARMA.',
  70, 4, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='forecasting-for-data-science' and s.slug='hamilton-time-series-analysis'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'forecasting-stationary-arma',
  c.id, s.id, 'Semana 2', 3,
  'Procesos AR, MA y ARMA estacionarios',
  'Hamilton, Chapter 3: Stationary ARMA Processes, pp. 43–71',
  'Reconocer AR, MA y ARMA; razonar sobre estacionariedad, invertibilidad y autocovarianza.',
  'Es el vocabulario operativo central para modelar dependencia temporal antes de pasar a forecasting.',
  90, 4, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='forecasting-for-data-science' and s.slug='hamilton-time-series-analysis'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'forecasting-first-forecast',
  c.id, s.id, 'Semana 3', 4,
  'Del proceso al pronóstico',
  'Hamilton, Chapter 4: Forecasting, pp. 72–116',
  'Entender la lógica de proyección, actualización del forecast y el vínculo entre modelo y error de predicción.',
  'Evita aprender ARMA como taxonomía aislada: el objetivo final es producir predicciones condicionadas a información disponible.',
  80, 4, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='forecasting-for-data-science' and s.slug='hamilton-time-series-analysis'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'math-matrix-actions',
  c.id, s.id, 'Semana 1', 1,
  'Pensar matrices como acciones: Ax y AB',
  'Strang, Part I §§ I.1–I.2',
  'Interpretar Ax por columnas, comprender composición matricial y conectar álgebra con transformaciones.',
  'Es la gramática mínima para modelos lineales, redes neuronales, PCA y optimización.',
  65, 3, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='matematica-ml-ia' and s.slug='strang-linear-algebra-learning-data'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'math-subspaces-elimination-orthogonality',
  c.id, s.id, 'Semana 1–2', 2,
  'Subespacios, eliminación y ortogonalidad',
  'Strang, Part I §§ I.3–I.5',
  'Conectar espacios fundamentales, factorización LU y ortogonalidad con resolución y geometría.',
  'Estos conceptos reaparecen en least squares, regularización, descomposiciones y representación de datos.',
  90, 4, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='matematica-ml-ia' and s.slug='strang-linear-algebra-learning-data'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

insert into public.sds_reading_units
  (slug, course_id, source_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'math-eigen-svd-pca',
  c.id, s.id, 'Semana 2–3', 3,
  'Eigenvalues → SVD → PCA',
  'Strang, Part I §§ I.6–I.9',
  'Construir el puente entre eigenvectors, singular vectors, rank-k approximation y principal components.',
  'Es una ruta directa desde álgebra lineal hacia reducción de dimensión, compresión y representación de datos.',
  100, 4, 'source_grounded'
from public.sds_courses c, public.sds_reading_sources s
where c.slug='matematica-ml-ia' and s.slug='strang-linear-algebra-learning-data'
on conflict (slug) do update set objective=excluded.objective, why_it_matters=excluded.why_it_matters, active=true;

-- Official-resource companion routes for the other courses.
insert into public.sds_reading_units
  (slug, course_id, external_resource_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'ml-fundamentals-first-weeks',
  c.id, r.id, 'Primeras semanas', 1,
  'Supervised learning: problema, validación y generalización',
  'MIT 6.036 — empezar por formulación del problema y fundamentos de supervised learning',
  'Alinear train/validation/test, generalización y error antes de optimizar algoritmos.',
  'Un modelo útil empieza por un contrato de evaluación honesto, no por elegir el algoritmo más complejo.',
  60, 3, 'official_resource_mapped'
from public.sds_courses c
join public.sds_external_resources r on r.slug='mit-6-036-intro-ml'
where c.slug='ml-supervisado-fundamentals'
on conflict (slug) do update set objective=excluded.objective, active=true;

insert into public.sds_reading_units
  (slug, course_id, external_resource_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'ml-advanced-first-weeks',
  c.id, r.id, 'Puente de entrada', 1,
  'De supervised learning a redes profundas',
  'MIT 6.S191 — fundamentos introductorios y neural networks',
  'Conectar funciones de pérdida, gradientes, backpropagation y arquitectura.',
  'Crea continuidad entre cálculo/optimización y modelos supervisados avanzados.',
  60, 4, 'official_resource_mapped'
from public.sds_courses c
join public.sds_external_resources r on r.slug='mit-6-s191-deep-learning'
where c.slug='ml-supervisado-advanced'
on conflict (slug) do update set objective=excluded.objective, active=true;

insert into public.sds_reading_units
  (slug, course_id, external_resource_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'unsupervised-first-weeks',
  c.id, r.id, 'Primeras semanas', 1,
  'Estructura sin labels: distancia, clustering y PCA',
  'Stanford CS229 materials — unsupervised learning sections',
  'Entender qué significa descubrir estructura cuando no existe una variable objetivo.',
  'Evita tratar clustering o PCA como botones: obliga a justificar métrica, representación y criterio de utilidad.',
  70, 4, 'official_resource_mapped'
from public.sds_courses c
join public.sds_external_resources r on r.slug='stanford-cs229-materials'
where c.slug='ml-no-supervisado'
on conflict (slug) do update set objective=excluded.objective, active=true;

insert into public.sds_reading_units
  (slug, course_id, external_resource_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'cybersecurity-first-weeks',
  c.id, r.id, 'Primeras semanas', 1,
  'Threat model antes de controles',
  'Harvard CS50 Cybersecurity — foundations',
  'Identificar activos, adversarios, superficies de ataque, controles e impacto.',
  'La seguridad de IA se vuelve concreta cuando cada riesgo tiene un activo, una amenaza y una consecuencia observable.',
  55, 3, 'official_resource_mapped'
from public.sds_courses c
join public.sds_external_resources r on r.slug='harvard-cs50-cybersecurity'
where c.slug='ciberseguridad-ia'
on conflict (slug) do update set objective=excluded.objective, active=true;

insert into public.sds_reading_units
  (slug, course_id, external_resource_id, week_label, sequence, title, source_locator, objective, why_it_matters, estimated_minutes, difficulty, grounding_status)
select
  'thesis-first-weeks',
  c.id, r.id, 'Primeras semanas', 1,
  'Pregunta → evidencia → propuesta reproducible',
  'Stanford CS229 — final project framework',
  'Convertir una idea amplia en pregunta, propuesta, milestone y evidencia verificable.',
  'La tesis debe integrar lo aprendido en los otros cursos y producir un resultado reproducible, no solo un documento.',
  55, 3, 'official_resource_mapped'
from public.sds_courses c
join public.sds_external_resources r on r.slug='stanford-cs229-projects'
where c.slug='proyecto-integrador-tesis'
on conflict (slug) do update set objective=excluded.objective, active=true;

-- Study artifacts: concise, original and source-aware.
with u as (
  select id from public.sds_reading_units where slug='forecasting-dependence-stationarity'
)
insert into public.sds_reading_artifacts(reading_unit_id, artifact_type, title, content)
select id, 'summary', 'One-page brief — Stationarity', jsonb_build_object(
  'thesis','Una serie temporal no es una colección i.i.d.; la dependencia es simultáneamente el problema inferencial y la fuente de capacidad predictiva.',
  'ideas',jsonb_build_array(
    'Separar dependencia temporal de independencia transversal.',
    'Distinguir estacionariedad estricta de estacionariedad de segundo orden.',
    'Usar ruido blanco como bloque básico, no como sinónimo de cualquier error.',
    'Reconocer break y random walk como ejemplos que rompen estabilidad temporal.'
  ),
  'questions',jsonb_build_array(
    '¿Qué propiedad debe permanecer estable para que una media o covarianza histórica informe sobre el futuro?',
    '¿Por qué un random walk no tiene varianza constante?',
    '¿Qué tipo de dependencia puedes explotar para forecast sin invalidar inferencia?'
  )
) from u
on conflict do nothing;

with u as (
  select id from public.sds_reading_units where slug='forecasting-dependence-stationarity'
)
insert into public.sds_reading_artifacts(reading_unit_id, artifact_type, title, content)
select id, 'infographic', 'Mapa visual — de dependencia a forecast', jsonb_build_object(
  'nodes',jsonb_build_array(
    'Dependencia temporal','Estabilidad / stationarity','Lag operator','AR / MA','ARMA','Autocovariance','Forecast'
  ),
  'edges',jsonb_build_array(
    'Dependencia temporal → exige corregir inferencia',
    'Dependencia temporal → permite forecast',
    'Stationarity → hace comparables momentos en el tiempo',
    'Lag operator → compacta dinámica',
    'AR/MA → construyen ARMA',
    'Autocovariance → describe memoria lineal',
    'Modelo + información → forecast'
  )
) from u
on conflict do nothing;

with u as (
  select id from public.sds_reading_units where slug='forecasting-lag-operator'
)
insert into public.sds_reading_artifacts(reading_unit_id, artifact_type, title, content)
select id, 'derivation_sheet', 'Derivation sheet — lag operator', jsonb_build_object(
  'moves',jsonb_build_array(
    'Reescribe y_t = ρ y_{t-1} + ε_t como (1-ρL)y_t = ε_t.',
    'Pregunta cuándo (1-ρL) puede invertirse como una serie infinita.',
    'Relaciona estabilidad con raíces del polinomio fuera del círculo unitario.',
    'Convierte un AR estacionario en una representación MA(∞).'
  ),
  'self_check',jsonb_build_array(
    'Puedo expandir (1-ρL)^{-1} sin mirar apuntes.',
    'Puedo explicar por qué |ρ|<1 importa.',
    'Puedo distinguir raíz del polinomio de coeficiente dinámico.'
  )
) from u
on conflict do nothing;

with u as (
  select id from public.sds_reading_units where slug='forecasting-stationary-arma'
)
insert into public.sds_reading_artifacts(reading_unit_id, artifact_type, title, content)
select id, 'practice_set', 'Practice set — AR/MA/ARMA', jsonb_build_object(
  'prompts',jsonb_build_array(
    'Deriva la media y varianza de un AR(1) estacionario.',
    'Explica con tus palabras por qué un AR(1) puede verse como MA(∞).',
    'Da un ejemplo de proceso estacionario pero no invertible y explica la diferencia conceptual.',
    'A partir de una ACF hipotética, argumenta qué familia de modelos explorarías primero.',
    'Compara causalidad/estacionariedad e invertibilidad: ¿qué pregunta responde cada propiedad?'
  )
) from u
on conflict do nothing;

with u as (
  select id from public.sds_reading_units where slug='math-matrix-actions'
)
insert into public.sds_reading_artifacts(reading_unit_id, artifact_type, title, content)
select id, 'orientation_letter', 'Carta de entrada — cómo leer Strang para ML', jsonb_build_object(
  'body','No intentes memorizar identidades de matrices como una lista. En cada sección pregúntate qué transformación ejecuta la matriz, qué información conserva y qué pierde. El objetivo de esta primera ruta es que Ax deje de ser una fórmula y se vuelva una acción geométrica y computacional. Cuando puedas explicar una multiplicación por columnas, componer dos transformaciones y anticipar dimensiones antes de calcular, ya estarás leyendo el resto del libro con una ventaja enorme.'
) from u
on conflict do nothing;

with u as (
  select id from public.sds_reading_units where slug='math-eigen-svd-pca'
)
insert into public.sds_reading_artifacts(reading_unit_id, artifact_type, title, content)
select id, 'infographic', 'Mapa visual — Eigen → SVD → PCA', jsonb_build_object(
  'nodes',jsonb_build_array(
    'Symmetric matrix','Eigenvectors','Singular values','Rank-k approximation','Covariance matrix','Principal components'
  ),
  'edges',jsonb_build_array(
    'Symmetric matrix → orthogonal eigenvectors',
    'General matrix → SVD supplies left/right singular vectors',
    'Descending singular values → ordered information',
    'Truncated SVD → best low-rank approximation',
    'Covariance structure → directions of greatest variance',
    'Those directions → principal components'
  )
) from u
on conflict do nothing;

-- Generic 4-step checklist for every reading unit.
insert into public.sds_reading_task_templates
  (reading_unit_id, task_key, sequence, task_type, title, instructions, evidence_expected, estimated_minutes, priority)
select
  u.id,
  x.task_key,
  x.sequence,
  x.task_type,
  x.title,
  replace(x.instructions, '{UNIT}', u.title),
  x.evidence_expected,
  x.minutes,
  x.priority
from public.sds_reading_units u
cross join (values
  ('preview',1,'preview','Preview inteligente',
   'Antes de leer {UNIT}, escribe 3 preguntas que esperas poder responder al terminar.',
   '3 preguntas propias',8,3),
  ('read',2,'read','Lectura activa',
   'Lee la sección indicada de {UNIT}. Marca definiciones, supuestos y una derivación o argumento que no puedas reconstruir todavía.',
   'Notas breves: definiciones + supuesto + punto difícil',30,5),
  ('explain',3,'explain','Explícalo sin mirar',
   'Cierra la fuente y explica {UNIT} con tus palabras. Si necesitas mirar, registra exactamente qué hueco apareció.',
   'Explicación propia + 1 hueco identificado',12,5),
  ('practice',4,'solve','Prueba de transferencia',
   'Resuelve al menos un ejercicio, derivación o caso aplicado relacionado con {UNIT}. No marques completado solo por haber leído.',
   'Respuesta, derivación o mini-aplicación',20,5)
) as x(task_key,sequence,task_type,title,instructions,evidence_expected,minutes,priority)
where u.active
on conflict (reading_unit_id, task_key) do update set
  title=excluded.title,
  instructions=excluded.instructions,
  evidence_expected=excluded.evidence_expected,
  estimated_minutes=excluded.estimated_minutes,
  priority=excluded.priority,
  active=true;
