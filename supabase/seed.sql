-- SÓCRATES DS V0.1 canonical seed
-- Idempotent. Unknown academic metadata stays NULL rather than being guessed.

insert into public.sds_courses
  (slug, name, instructor, credits, academic_hours, day_of_week, start_time, end_time, learning_role, color_token, source_status)
values
  ('forecasting-for-data-science', 'Forecasting for Data Science', 'Prof. Jaime Lincovil', 2, 24, 1, '18:00', '21:00', 'Time, uncertainty, temporal validation, forecasting and decision-making.', 'sky', 'provided_timetable'),
  ('ml-supervisado-advanced', 'Machine Learning Supervisado Advanced', 'Prof. Miguel Galarreta', 2, 24, 1, '19:00', '22:00', 'Advanced supervised learning, tuning, calibration, interpretation and model comparison.', 'blue', 'provided_timetable'),
  ('ciberseguridad-ia', 'Electivo 2 — Ciberseguridad de IA', 'Prof. Alan Morante', 2, 24, 2, '19:00', '22:00', 'Security, privacy, adversarial risk, governance and responsible AI.', 'green', 'provided_timetable'),
  ('matematica-ml-ia', 'Matemática para ML e IA', null, null, null, 3, '19:00', '22:00', 'Linear algebra, calculus, probability and optimization foundations for machine learning.', 'rose', 'provided_timetable_partial'),
  ('ml-supervisado-fundamentals', 'Machine Learning Supervisado Fundamentals', 'Prof. Amao Suxo', 3, 36, 4, '19:00', '22:00', 'Core supervised learning, evaluation, generalization, features and reproducible modeling.', 'amber', 'provided_timetable'),
  ('ml-no-supervisado', 'Machine Learning No Supervisado', 'Prof. Kevin Fernández', 3, 36, 6, '10:00', '13:00', 'Latent structure, clustering, representation and dimensionality reduction.', 'violet', 'provided_timetable'),
  ('proyecto-integrador-tesis', 'Proyecto Integrador — Desarrollo del Plan de Tesis', 'Prof. Kevin Fernández', 2, 24, 6, '14:00', '17:00', 'Research design, integration, reproducibility, evidence and thesis production.', 'purple', 'provided_timetable')
on conflict (slug) do update set
  name = excluded.name,
  instructor = excluded.instructor,
  credits = excluded.credits,
  academic_hours = excluded.academic_hours,
  day_of_week = excluded.day_of_week,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  learning_role = excluded.learning_role,
  color_token = excluded.color_token,
  source_status = excluded.source_status,
  active = true;

insert into public.sds_concepts (canonical_key, title, description, difficulty, tags)
values
  ('vectors-matrices', 'Vectores y matrices', 'Representación, operaciones y geometría lineal para ML.', 2, array['math','linear-algebra']),
  ('derivatives-gradients', 'Derivadas y gradientes', 'Derivadas parciales, gradiente y sensibilidad local.', 3, array['math','calculus']),
  ('optimization-gradient-descent', 'Optimización y gradient descent', 'Funciones objetivo, dirección de descenso y tasa de aprendizaje.', 3, array['math','optimization']),
  ('probability-uncertainty', 'Probabilidad e incertidumbre', 'Variables aleatorias, distribuciones y razonamiento probabilístico.', 3, array['math','probability']),

  ('train-validation-test', 'Train / validation / test', 'Separación de datos y estimación honesta del desempeño.', 2, array['supervised','evaluation']),
  ('bias-variance', 'Bias–variance', 'Generalización, underfitting, overfitting y complejidad.', 3, array['supervised','generalization']),
  ('regularization', 'Regularización', 'Penalización, L1/L2 y control de complejidad.', 3, array['supervised','optimization']),
  ('classification-metrics', 'Métricas de clasificación', 'Precision, recall, ROC-AUC, PR-AUC y selección de umbrales.', 2, array['supervised','metrics']),

  ('ensembles-boosting', 'Ensembles y boosting', 'Bagging, boosting y combinación de learners.', 4, array['advanced','ensemble']),
  ('hyperparameter-tuning', 'Hyperparameter tuning', 'Búsqueda, validación y prevención de overfitting al tuning.', 4, array['advanced','tuning']),
  ('calibration', 'Calibración probabilística', 'Alineación entre probabilidades predichas y frecuencias observadas.', 4, array['advanced','probability']),
  ('model-interpretability', 'Interpretabilidad', 'Explicar predicciones, variables y límites de inferencia.', 3, array['advanced','interpretability']),

  ('time-series-validation', 'Validación temporal', 'Backtesting y particiones que respetan el orden temporal.', 3, array['forecasting','validation']),
  ('stationarity', 'Estacionariedad', 'Propiedades temporales, transformaciones y estabilidad.', 3, array['forecasting','timeseries']),
  ('autocorrelation', 'Autocorrelación', 'Dependencia temporal y estructuras de rezagos.', 3, array['forecasting','timeseries']),

  ('distance-similarity', 'Distancia y similitud', 'Métricas geométricas para comparar observaciones.', 2, array['unsupervised','geometry']),
  ('pca', 'PCA', 'Proyección lineal y reducción de dimensionalidad.', 4, array['unsupervised','dimensionality']),
  ('clustering', 'Clustering', 'Agrupamiento, elección de k y evaluación sin labels.', 3, array['unsupervised','clustering']),

  ('ai-threat-model', 'Threat modeling para IA', 'Activos, adversarios, superficies de ataque e impacto.', 3, array['security','ai-risk']),
  ('adversarial-ml', 'Adversarial ML', 'Evasión, poisoning y robustez de modelos.', 4, array['security','adversarial']),
  ('privacy-governance', 'Privacidad y governance', 'Controles, acceso, minimización y trazabilidad.', 3, array['security','governance']),

  ('research-question', 'Pregunta de investigación', 'Pregunta precisa, relevante y falsable.', 3, array['thesis','research']),
  ('research-design', 'Diseño de investigación', 'Unidad de análisis, identificación, variables y método.', 4, array['thesis','methodology']),
  ('reproducibility', 'Reproducibilidad', 'Provenance, versiones, código, datos y decisiones auditables.', 3, array['thesis','reproducibility'])
on conflict (canonical_key) do update set
  title = excluded.title,
  description = excluded.description,
  difficulty = excluded.difficulty,
  tags = excluded.tags;

insert into public.sds_course_concepts (course_id, concept_id, module, role)
select c.id, x.id, 'Foundation', 'core'
from public.sds_courses c
join public.sds_concepts x on
  (c.slug = 'matematica-ml-ia' and x.canonical_key in ('vectors-matrices','derivatives-gradients','optimization-gradient-descent','probability-uncertainty'))
  or (c.slug = 'ml-supervisado-fundamentals' and x.canonical_key in ('train-validation-test','bias-variance','regularization','classification-metrics'))
  or (c.slug = 'ml-supervisado-advanced' and x.canonical_key in ('ensembles-boosting','hyperparameter-tuning','calibration','model-interpretability'))
  or (c.slug = 'forecasting-for-data-science' and x.canonical_key in ('time-series-validation','stationarity','autocorrelation'))
  or (c.slug = 'ml-no-supervisado' and x.canonical_key in ('distance-similarity','pca','clustering'))
  or (c.slug = 'ciberseguridad-ia' and x.canonical_key in ('ai-threat-model','adversarial-ml','privacy-governance'))
  or (c.slug = 'proyecto-integrador-tesis' and x.canonical_key in ('research-question','research-design','reproducibility'))
on conflict do nothing;

insert into public.sds_concept_dependencies
  (prerequisite_concept_id, dependent_concept_id, strength, rationale)
select a.id, b.id, 1.0, d.rationale
from (values
  ('derivatives-gradients','optimization-gradient-descent','Gradient descent requires understanding gradients.'),
  ('probability-uncertainty','calibration','Calibration is interpreted probabilistically.'),
  ('train-validation-test','hyperparameter-tuning','Tuning requires honest validation design.'),
  ('bias-variance','regularization','Regularization manages model complexity and variance.'),
  ('vectors-matrices','pca','PCA depends on linear algebra.'),
  ('distance-similarity','clustering','Many clustering methods rely on a notion of similarity.'),
  ('time-series-validation','research-design','Temporal evaluation is part of valid research design for forecasting.'),
  ('research-question','research-design','Design follows the research question.'),
  ('research-design','reproducibility','Reproducibility must preserve the chosen design.')
) as d(prereq, dep, rationale)
join public.sds_concepts a on a.canonical_key = d.prereq
join public.sds_concepts b on b.canonical_key = d.dep
on conflict do nothing;

insert into public.sds_question_bank
  (course_id, concept_id, mode, dimension, prompt, answer_guide, difficulty)
select c.id, x.id, q.mode::public.sds_session_mode, q.dimension, q.prompt, q.answer_guide, q.difficulty
from (values
  ('matematica-ml-ia','derivatives-gradients','socratic','conceptual',
   'Sin usar una fórmula: ¿qué información te da el gradiente de una función en un punto?',
   'Debe aparecer la idea de dirección local de mayor incremento y magnitud de sensibilidad.',2),
  ('matematica-ml-ia','optimization-gradient-descent','feynman','mathematical',
   'Explícale a una persona técnica por qué gradient descent usa el negativo del gradiente.',
   'El gradiente apunta al mayor incremento local; negarlo produce una dirección de descenso local.',3),

  ('ml-supervisado-fundamentals','train-validation-test','examiner','conceptual',
   'Tienes 10,000 observaciones. Describe una estrategia de train/validation/test y qué decisión se toma con cada partición.',
   'Train ajusta parámetros; validation selecciona decisiones de modelado; test estima desempeño final no usado en selección.',2),
  ('ml-supervisado-fundamentals','bias-variance','socratic','transfer',
   'Tu modelo tiene 99% de accuracy en train y 71% en validation. ¿Qué hipótesis investigarías antes de cambiar de algoritmo?',
   'Debe considerar overfitting, leakage, complejidad, distribución, features y calidad de validación.',3),

  ('ml-supervisado-advanced','calibration','feynman','conceptual',
   '¿Qué significa que un modelo esté bien calibrado si asigna probabilidad 0.8 a muchos casos?',
   'Entre casos comparables con probabilidad 0.8, aproximadamente 80% deberían materializar el evento.',3),
  ('ml-supervisado-advanced','hyperparameter-tuning','examiner','transfer',
   'Explica cómo podrías sobreajustar al validation set aun cuando nunca entrenas directamente con él.',
   'Repetir decisiones basadas en el mismo validation set adapta indirectamente el proceso a ese conjunto.',4),

  ('forecasting-for-data-science','time-series-validation','socratic','transfer',
   '¿Por qué un split aleatorio puede producir una estimación engañosa en forecasting?',
   'Puede usar información futura para validar el pasado y romper la estructura temporal / generar leakage.',3),
  ('forecasting-for-data-science','stationarity','feynman','conceptual',
   'Explica estacionariedad sin definirla solo como “media y varianza constantes”. ¿Por qué importa?',
   'Debe conectar estabilidad de propiedades temporales con inferencia/modelado y reconocer distintos tipos de estacionariedad.',3),

  ('ml-no-supervisado','pca','socratic','mathematical',
   'Antes de calcular PCA, ¿qué papel juegan escala, varianza y direcciones lineales en el resultado?',
   'PCA maximiza varianza proyectada; la escala puede dominar y los componentes son combinaciones lineales ortogonales.',4),
  ('ml-no-supervisado','clustering','examiner','transfer',
   'Dos soluciones de clustering tienen el mismo silhouette score. ¿Qué evidencia adicional usarías para decidir?',
   'Estabilidad, interpretabilidad, utilidad de negocio, sensibilidad, tamaño de clusters y validación externa cuando exista.',3),

  ('ciberseguridad-ia','ai-threat-model','socratic','transfer',
   'Para un modelo de lead scoring, identifica un activo, un adversario, una superficie de ataque y un impacto.',
   'Debe distinguir claramente los cuatro elementos y conectarlos causalmente.',3),
  ('ciberseguridad-ia','adversarial-ml','feynman','conceptual',
   'Diferencia evasión de poisoning con un ejemplo de cada uno.',
   'Evasión altera inputs en inferencia; poisoning contamina entrenamiento o datos de aprendizaje.',3),

  ('proyecto-integrador-tesis','research-question','socratic','transfer',
   'Formula una pregunta de investigación que sea específica, falsable y respondible con datos reales.',
   'Debe definir población/unidad, fenómeno, relación o predicción, alcance y criterio de evidencia.',3),
  ('proyecto-integrador-tesis','reproducibility','examiner','transfer',
   'Enumera la evidencia mínima para que otra persona pueda reproducir tu resultado dentro de seis meses.',
   'Datos/versiones, código, dependencias, parámetros, semillas, transformaciones, query/lineage, decisiones y ambiente.',3)
) as q(course_slug, concept_key, mode, dimension, prompt, answer_guide, difficulty)
join public.sds_courses c on c.slug = q.course_slug
join public.sds_concepts x on x.canonical_key = q.concept_key
where not exists (
  select 1 from public.sds_question_bank qb
  where qb.course_id = c.id and qb.concept_id = x.id and qb.prompt = q.prompt
);
