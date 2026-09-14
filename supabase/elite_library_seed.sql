-- SÓCRATES DS V0.3 — curated official Ivy+ learning library
-- We store links and original metadata, not mirrored copies of university content.

insert into public.sds_concepts (canonical_key, title, description, difficulty, tags)
values
  ('neural-networks', 'Redes neuronales', 'Arquitecturas neuronales, funciones de activación y representación aprendida.', 4, array['advanced','deep-learning']),
  ('backpropagation', 'Backpropagation', 'Regla de la cadena aplicada al entrenamiento de redes neuronales.', 4, array['advanced','optimization']),
  ('forecast-evaluation', 'Evaluación de pronósticos', 'Backtesting, errores de pronóstico, intervalos y comparación de modelos.', 3, array['forecasting','evaluation']),
  ('arima-state-space', 'ARIMA y state-space', 'Modelos ARIMA, espacio de estados, filtrado y dinámica temporal.', 4, array['forecasting','timeseries']),
  ('data-leakage', 'Data leakage', 'Uso indebido de información no disponible al momento real de predicción.', 3, array['supervised','validation']),
  ('adversarial-robustness', 'Robustez adversarial', 'Vulnerabilidad de modelos ante perturbaciones, evasión y ataques.', 4, array['security','ml-security'])
on conflict (canonical_key) do update set
  title = excluded.title,
  description = excluded.description,
  difficulty = excluded.difficulty,
  tags = excluded.tags;

insert into public.sds_course_concepts (course_id, concept_id, module, role)
select c.id, x.id, 'Ivy+ extension', 'core'
from public.sds_courses c
join public.sds_concepts x on
  (c.slug = 'ml-supervisado-advanced' and x.canonical_key in ('neural-networks','backpropagation'))
  or (c.slug = 'forecasting-for-data-science' and x.canonical_key in ('forecast-evaluation','arima-state-space'))
  or (c.slug = 'ml-supervisado-fundamentals' and x.canonical_key = 'data-leakage')
  or (c.slug = 'ciberseguridad-ia' and x.canonical_key = 'adversarial-robustness')
on conflict do nothing;

insert into public.sds_concept_dependencies
  (prerequisite_concept_id, dependent_concept_id, strength, rationale)
select a.id, b.id, d.strength, d.rationale
from (values
  ('derivatives-gradients','backpropagation',1.0::numeric,'Backpropagation applies derivatives and the chain rule.'),
  ('vectors-matrices','neural-networks',0.9::numeric,'Neural network operations rely heavily on vector and matrix operations.'),
  ('backpropagation','neural-networks',0.9::numeric,'Training neural networks requires backpropagation.'),
  ('time-series-validation','forecast-evaluation',1.0::numeric,'Forecast evaluation must respect temporal ordering.'),
  ('stationarity','arima-state-space',0.8::numeric,'Classical ARIMA reasoning relies on understanding stationarity.'),
  ('train-validation-test','data-leakage',0.9::numeric,'Leakage is diagnosed through a correct validation contract.'),
  ('ai-threat-model','adversarial-robustness',0.8::numeric,'Robustness work starts by defining adversaries and attack surfaces.')
) as d(prereq, dep, strength, rationale)
join public.sds_concepts a on a.canonical_key = d.prereq
join public.sds_concepts b on b.canonical_key = d.dep
on conflict do nothing;

insert into public.sds_external_resources
  (slug, institution, course_code, course_title, title, description, url,
   resource_type, access_type, level, provider, source_year, learning_role,
   license_note, official, featured)
values
  (
    'mit-18-06sc-linear-algebra',
    'MIT','18.06SC','Linear Algebra',
    'MIT 18.06SC — Linear Algebra',
    'Curso de autoestudio de Gilbert Strang con videos, notas, problem sets, soluciones y exámenes. Es la base principal para matrices, subespacios y geometría lineal.',
    'https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/',
    'open_course','open_full','foundation','MIT OpenCourseWare','2011',
    'Construir intuición y fluidez operativa antes de optimización, PCA y modelos lineales.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'mit-18-065-matrix-methods-ml',
    'MIT','18.065','Matrix Methods in Data Analysis, Signal Processing, and Machine Learning',
    'MIT 18.065 — Matrix Methods for Data Analysis & ML',
    'Álgebra lineal aplicada directamente a data analysis, probabilidad, estadística, optimización y deep learning.',
    'https://ocw.mit.edu/courses/18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018/',
    'open_course','open_full','advanced','MIT OpenCourseWare','2018',
    'Puente entre Matemática para ML, PCA, optimización y redes neuronales.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'stanford-cs109-probability',
    'Stanford','CS109','Probability for Computer Scientists',
    'Stanford CS109 — Probability for Computer Scientists',
    'Curso oficial con materiales de probabilidad, inferencia, estimación y aplicaciones de machine learning.',
    'https://web.stanford.edu/class/cs109/',
    'course_materials','free','foundation','Stanford University','2026',
    'Fortalecer probabilidad e incertidumbre con orientación computacional.',
    'Enlace oficial de Stanford; el contenido permanece alojado por Stanford.',true,true
  ),
  (
    'stanford-cs229-materials',
    'Stanford','CS229','Machine Learning',
    'Stanford CS229 — Machine Learning Materials',
    'Colección oficial de notas de supervised learning, regularización, SVM, learning theory, clustering, EM, PCA, Gaussian processes y optimización.',
    'https://cs229.stanford.edu/materials.html',
    'course_materials','free','advanced','Stanford University',null,
    'Referencia central para fundamentos, advanced supervised y unsupervised learning.',
    'Enlace oficial de Stanford; el contenido permanece alojado por Stanford.',true,true
  ),
  (
    'mit-6-036-intro-ml',
    'MIT','6.036','Introduction to Machine Learning',
    'MIT 6.036 — Introduction to Machine Learning',
    'Curso abierto sobre formulación de problemas de aprendizaje, representación, overfitting, generalización y algoritmos de ML.',
    'https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/',
    'open_course','open_full','intermediate','MIT OpenCourseWare','2020',
    'Curso espejo de alto valor para Machine Learning Supervisado Fundamentals.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'harvard-cs50-ai',
    'Harvard','CS50 AI','Introduction to Artificial Intelligence with Python',
    'Harvard CS50 AI — Artificial Intelligence with Python',
    'Curso abierto con proyectos sobre uncertainty, optimization, learning, neural networks y otros fundamentos de IA implementados en Python.',
    'https://cs50.harvard.edu/ai/2024/',
    'open_course','open_full','intermediate','Harvard CS50 OpenCourseWare','2024',
    'Añadir una capa práctica y de implementación Python a matemáticas y ML.',
    'Material oficial CS50; revisar la licencia mostrada por Harvard CS50 antes de reutilizar contenido.',true,true
  ),
  (
    'mit-6-s191-deep-learning',
    'MIT','6.S191','Introduction to Deep Learning',
    'MIT 6.S191 — Introduction to Deep Learning',
    'Introducción intensiva a deep learning con fundamentos, redes neuronales y aplicaciones modernas.',
    'https://ocw.mit.edu/courses/6-s191-introduction-to-deep-learning-january-iap-2020/',
    'open_course','open_full','advanced','MIT OpenCourseWare','2026',
    'Extensión prioritaria para Machine Learning Supervisado Advanced.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'stanford-cs224n-2026',
    'Stanford','CS224N','Natural Language Processing with Deep Learning',
    'Stanford CS224N — NLP with Deep Learning',
    'Curso 2026 con slides, notas y lecturas sobre neural networks, backpropagation, embeddings y deep learning para NLP.',
    'https://web.stanford.edu/class/cs224n/',
    'course_materials','free','advanced','Stanford University','2026',
    'Laboratorio avanzado para transferir redes neuronales a problemas reales.',
    'Enlace oficial de Stanford; el contenido permanece alojado por Stanford.',true,false
  ),
  (
    'mit-14-384-time-series',
    'MIT','14.384','Time Series Analysis',
    'MIT 14.384 — Time Series Analysis',
    'Curso graduate de teoría y aplicación de series de tiempo: estacionariedad, VAR, structural breaks, state-space, Kalman y métodos bayesianos.',
    'https://ocw.mit.edu/courses/14-384-time-series-analysis-fall-2013/',
    'open_course','open_full','graduate','MIT OpenCourseWare','2013',
    'Columna vertebral teórica para Forecasting for Data Science.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'mit-14-384-lecture-notes',
    'MIT','14.384','Time Series Analysis',
    'MIT 14.384 — Lecture Notes',
    'Notas descargables sobre stationarity, ARMA, spectrum, VAR, unit roots, cointegration, filtering y state-space.',
    'https://ocw.mit.edu/courses/14-384-time-series-analysis-fall-2013/pages/lecture-notes/',
    'lecture_notes','open_full','graduate','MIT OpenCourseWare','2013',
    'Biblioteca de referencia para profundizar en temas puntuales del curso de Forecasting.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,false
  ),
  (
    'stanford-econ105-economic-forecasting',
    'Stanford','ECON105','Economic Forecasting',
    'Stanford ECON105 — Economic Forecasting',
    'Benchmark curricular de forecasting con tendencia, estacionalidad, smoothing, ARMA, cointegration, forecast evaluation, VAR, GARCH y scenarios.',
    'https://bulletin.stanford.edu/courses/2256571',
    'benchmark_syllabus','benchmark_only','advanced','Stanford University Bulletin','2026',
    'Usar como benchmark de cobertura; no sustituye materiales abiertos.',
    'Ficha oficial de curso; puede no ofrecer materiales públicos completos.',true,false
  ),
  (
    'stanford-stats207-time-series',
    'Stanford','STATS207','Time Series Analysis',
    'Stanford STATS207 — Time Series Analysis',
    'Benchmark curricular que combina fundamentos matemáticos, autoregression, spectral analysis, state-space y forecasters de deep learning.',
    'https://bulletin.stanford.edu/courses/1254251',
    'benchmark_syllabus','benchmark_only','advanced','Stanford University Bulletin','2026',
    'Comparar tu sílabo de Forecasting con una ruta moderna de Stanford.',
    'Ficha oficial de curso; puede no ofrecer materiales públicos completos.',true,false
  ),
  (
    'harvard-stat131-time-series',
    'Harvard','STAT 131','Time Series & Prediction',
    'Harvard STAT 131 — Time Series & Prediction',
    'Benchmark curricular de ARIMA, stochastic processes, HMM, state-space, Kalman filters y sequential Monte Carlo.',
    'https://qrd.college.harvard.edu/directory/stat-131/',
    'benchmark_syllabus','benchmark_only','advanced','Harvard College','2026',
    'Benchmark para amplitud y profundidad del curso de Forecasting.',
    'Ficha oficial de Harvard; el acceso a Canvas/materiales puede requerir afiliación.',true,false
  ),
  (
    'harvard-cs50-cybersecurity',
    'Harvard','CS50 Cybersecurity','Introduction to Cybersecurity',
    'Harvard CS50 — Introduction to Cybersecurity',
    'OpenCourseWare gratuito sobre securing accounts, data, systems, software y preserving privacy, con assignments inspirados en casos reales.',
    'https://cs50.harvard.edu/cybersecurity/',
    'open_course','open_full','foundation','Harvard CS50 OpenCourseWare',null,
    'Base práctica de seguridad antes de entrar a adversarial ML y AI governance.',
    'Material oficial CS50; revisar la licencia mostrada por Harvard CS50 antes de reutilizar contenido.',true,true
  ),
  (
    'mit-6-858-systems-security',
    'MIT','6.858','Computer Systems Security',
    'MIT 6.858 — Computer Systems Security',
    'Curso graduate sobre threat models, attacks, information flow, network/security protocols, web security y secure systems.',
    'https://ocw.mit.edu/courses/6-858-computer-systems-security-fall-2014/',
    'open_course','open_full','graduate','MIT OpenCourseWare','2014',
    'Dar profundidad técnica al Electivo de Ciberseguridad de IA mediante fundamentos de threat modeling y systems security.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'mit-adversarial-human-ml-alignment',
    'MIT','RES.9-008','Brain and Cognitive Sciences Computational Tutorials',
    'MIT — Adversarial Examples and Human-ML Alignment',
    'Tutorial oficial sobre adversarial examples, brittleness de modelos y diferencias entre features humanas y features aprendidas por redes.',
    'https://ocw.mit.edu/courses/res-9-008-brain-and-cognitive-sciences-computational-tutorials/pages/adversarial-examples-and-human-ml-alignment/',
    'tutorial','open_full','advanced','MIT OpenCourseWare','2025',
    'Puente directo entre seguridad de IA, robustez y comportamiento de modelos.',
    'Material alojado por MIT OpenCourseWare; respetar los términos/licencia indicados por MIT.',true,true
  ),
  (
    'stanford-cs229-projects',
    'Stanford','CS229','Machine Learning',
    'Stanford CS229 — Final Project Framework',
    'Guía oficial de proyectos con proposal, milestone, poster y final report, orientada a aplicar ML en problemas reales o investigación.',
    'https://cs229.stanford.edu/projects_fall2020.html',
    'project_guide','free','advanced','Stanford University','2020',
    'Convertir Proyecto Integrador/Tesis en un ciclo de entregables técnicos y reproducibles.',
    'Enlace oficial de Stanford; el contenido permanece alojado por Stanford.',true,true
  ),
  (
    'harvard-inference-modeling',
    'Harvard',null,'Data Science: Inference and Modeling',
    'Harvard — Data Science: Inference and Modeling',
    'Curso de inferencia, confidence intervals, p-values, Bayesian modeling y construcción de un forecast simplificado.',
    'https://pll.harvard.edu/course/data-science-inference-and-modeling',
    'open_program','free_audit','intermediate','Harvard Online',null,
    'Reforzar inferencia y modelado antes de investigación y forecasting aplicado.',
    'La disponibilidad gratuita/certificada depende de la modalidad publicada por Harvard/edX.',true,false
  )
on conflict (slug) do update set
  institution = excluded.institution,
  course_code = excluded.course_code,
  course_title = excluded.course_title,
  title = excluded.title,
  description = excluded.description,
  url = excluded.url,
  resource_type = excluded.resource_type,
  access_type = excluded.access_type,
  level = excluded.level,
  provider = excluded.provider,
  source_year = excluded.source_year,
  learning_role = excluded.learning_role,
  license_note = excluded.license_note,
  official = excluded.official,
  featured = excluded.featured,
  active = true;

-- Map resources to the seven local courses.
with mappings(resource_slug, course_slug, priority, role, rationale) as (values
  ('mit-18-06sc-linear-algebra','matematica-ml-ia',1,'core','Base rigurosa de álgebra lineal.'),
  ('mit-18-065-matrix-methods-ml','matematica-ml-ia',1,'core','Aplica matrices directamente a ML.'),
  ('stanford-cs109-probability','matematica-ml-ia',1,'core','Probabilidad orientada a computer science y ML.'),
  ('stanford-cs229-materials','matematica-ml-ia',2,'recommended','Reviews de linear algebra, probability y convex optimization.'),

  ('mit-6-036-intro-ml','ml-supervisado-fundamentals',1,'core','Curso espejo de fundamentals, generalización y modeling.'),
  ('stanford-cs229-materials','ml-supervisado-fundamentals',1,'core','Notas de supervised learning, regularización y learning theory.'),
  ('harvard-cs50-ai','ml-supervisado-fundamentals',2,'recommended','Implementación práctica en Python.'),

  ('stanford-cs229-materials','ml-supervisado-advanced',1,'core','Referencia avanzada en SVM, model selection y teoría.'),
  ('mit-6-s191-deep-learning','ml-supervisado-advanced',1,'core','Extensión natural a neural networks y deep learning.'),
  ('stanford-cs224n-2026','ml-supervisado-advanced',2,'extension','Transferencia a redes modernas y NLP.'),

  ('stanford-cs229-materials','ml-no-supervisado',1,'core','Incluye k-means, Gaussian mixtures, EM, factor analysis, PCA e ICA.'),
  ('mit-18-065-matrix-methods-ml','ml-no-supervisado',2,'recommended','Fundamento matricial de PCA y representación.'),

  ('mit-14-384-time-series','forecasting-for-data-science',1,'core','Cobertura graduate de series de tiempo.'),
  ('mit-14-384-lecture-notes','forecasting-for-data-science',1,'recommended','Referencia por tema con lecture notes.'),
  ('stanford-econ105-economic-forecasting','forecasting-for-data-science',3,'benchmark','Benchmark de forecasting aplicado.'),
  ('stanford-stats207-time-series','forecasting-for-data-science',3,'benchmark','Benchmark moderno con state-space y deep learning.'),
  ('harvard-stat131-time-series','forecasting-for-data-science',3,'benchmark','Benchmark de amplitud teórica y métodos de estado.'),
  ('harvard-inference-modeling','forecasting-for-data-science',2,'recommended','Refuerza inferencia, incertidumbre y forecast probabilístico.'),

  ('harvard-cs50-cybersecurity','ciberseguridad-ia',1,'core','Fundamentos operativos de seguridad y privacidad.'),
  ('mit-6-858-systems-security','ciberseguridad-ia',1,'core','Threat models y secure systems a profundidad.'),
  ('mit-adversarial-human-ml-alignment','ciberseguridad-ia',1,'recommended','Puente directo hacia adversarial robustness.'),

  ('stanford-cs229-projects','proyecto-integrador-tesis',1,'core','Estructura proposal → milestone → poster → final report.'),
  ('harvard-inference-modeling','proyecto-integrador-tesis',2,'recommended','Fortalece inferencia y claridad metodológica.'),
  ('stanford-cs229-materials','proyecto-integrador-tesis',2,'extension','Permite conectar método, evaluación y aplicación real.')
)
insert into public.sds_external_resource_courses
  (resource_id, course_id, priority, role, rationale)
select r.id, c.id, m.priority, m.role, m.rationale
from mappings m
join public.sds_external_resources r on r.slug = m.resource_slug
join public.sds_courses c on c.slug = m.course_slug
on conflict (resource_id, course_id) do update set
  priority = excluded.priority,
  role = excluded.role,
  rationale = excluded.rationale;

-- Map resources to concepts for future recommendation and RAG.
with mappings(resource_slug, concept_key, relevance) as (values
  ('mit-18-06sc-linear-algebra','vectors-matrices',5),
  ('mit-18-06sc-linear-algebra','pca',3),
  ('mit-18-065-matrix-methods-ml','vectors-matrices',5),
  ('mit-18-065-matrix-methods-ml','pca',5),
  ('mit-18-065-matrix-methods-ml','optimization-gradient-descent',4),
  ('stanford-cs109-probability','probability-uncertainty',5),

  ('stanford-cs229-materials','train-validation-test',5),
  ('stanford-cs229-materials','bias-variance',5),
  ('stanford-cs229-materials','regularization',5),
  ('stanford-cs229-materials','classification-metrics',4),
  ('stanford-cs229-materials','clustering',5),
  ('stanford-cs229-materials','pca',5),
  ('stanford-cs229-materials','hyperparameter-tuning',4),
  ('mit-6-036-intro-ml','bias-variance',5),
  ('mit-6-036-intro-ml','train-validation-test',4),
  ('harvard-cs50-ai','optimization-gradient-descent',4),
  ('harvard-cs50-ai','neural-networks',4),
  ('mit-6-s191-deep-learning','neural-networks',5),
  ('mit-6-s191-deep-learning','backpropagation',5),
  ('stanford-cs224n-2026','neural-networks',5),
  ('stanford-cs224n-2026','backpropagation',5),

  ('mit-14-384-time-series','stationarity',5),
  ('mit-14-384-time-series','autocorrelation',5),
  ('mit-14-384-time-series','arima-state-space',5),
  ('mit-14-384-time-series','forecast-evaluation',4),
  ('mit-14-384-lecture-notes','stationarity',5),
  ('mit-14-384-lecture-notes','arima-state-space',5),
  ('stanford-econ105-economic-forecasting','forecast-evaluation',5),
  ('stanford-econ105-economic-forecasting','arima-state-space',5),
  ('stanford-stats207-time-series','arima-state-space',5),
  ('harvard-stat131-time-series','arima-state-space',5),
  ('harvard-inference-modeling','probability-uncertainty',4),
  ('harvard-inference-modeling','forecast-evaluation',3),

  ('harvard-cs50-cybersecurity','privacy-governance',5),
  ('harvard-cs50-cybersecurity','ai-threat-model',3),
  ('mit-6-858-systems-security','ai-threat-model',5),
  ('mit-6-858-systems-security','privacy-governance',4),
  ('mit-adversarial-human-ml-alignment','adversarial-robustness',5),
  ('mit-adversarial-human-ml-alignment','adversarial-ml',5),

  ('stanford-cs229-projects','research-question',4),
  ('stanford-cs229-projects','research-design',5),
  ('stanford-cs229-projects','reproducibility',4),
  ('harvard-inference-modeling','research-design',4)
)
insert into public.sds_external_resource_concepts
  (resource_id, concept_id, relevance)
select r.id, c.id, m.relevance
from mappings m
join public.sds_external_resources r on r.slug = m.resource_slug
join public.sds_concepts c on c.canonical_key = m.concept_key
on conflict (resource_id, concept_id) do update set
  relevance = excluded.relevance;
