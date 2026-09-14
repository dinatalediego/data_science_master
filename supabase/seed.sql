-- Canonical course seed for SÓCRATES DS V0.1
-- Unknown metadata is intentionally NULL rather than inferred.

insert into public.courses
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
