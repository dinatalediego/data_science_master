-- SÓCRATES DS V0.7.1 — official first-weeks grounding for remaining courses
-- Adds concise source notes from official MIT/Harvard/Stanford resources already curated in Ivy+.

insert into public.sds_reading_sources
  (slug,title,author,institution_or_publisher,publication_year,source_kind,external_url,access_note,citation_note)
values
  (
    'mit-6036-official',
    'Introduction to Machine Learning',
    'Leslie Kaelbling; Tomás Lozano-Pérez; Isaac Chuang; Duane Boning',
    'MIT OpenCourseWare',
    2020,
    'official_open_resource',
    'https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/',
    'Official MIT OpenCourseWare / Open Learning Library resource.',
    'MIT 6.036 Introduction to Machine Learning, Fall 2020.'
  ),
  (
    'mit-6s191-official',
    'Introduction to Deep Learning',
    'Alexander Amini; Ava Soleimany',
    'MIT OpenCourseWare',
    2026,
    'official_open_resource',
    'https://ocw.mit.edu/courses/6-s191-introduction-to-deep-learning-january-iap-2020/',
    'Official MIT OpenCourseWare resource; page metadata currently reflects January IAP 2026.',
    'MIT 6.S191 Introduction to Deep Learning.'
  ),
  (
    'stanford-cs229-unsupervised-official',
    'CS229 Machine Learning — Unsupervised Learning Materials',
    null,
    'Stanford University',
    null,
    'official_open_resource',
    'https://cs229.stanford.edu/materials.html',
    'Official Stanford CS229 materials and syllabus resources.',
    'Stanford CS229 Machine Learning — unsupervised learning materials.'
  ),
  (
    'harvard-cs50-cybersecurity-official',
    'CS50 Introduction to Cybersecurity',
    'David J. Malan',
    'Harvard University',
    2026,
    'official_open_resource',
    'https://cs50.harvard.edu/cybersecurity/',
    'Official Harvard CS50 OpenCourseWare resource.',
    'Harvard CS50 Introduction to Cybersecurity.'
  ),
  (
    'stanford-cs229-projects-official',
    'CS229 Machine Learning — Final Project Framework',
    null,
    'Stanford University',
    2020,
    'official_open_resource',
    'https://cs229.stanford.edu/projects_fall2020.html',
    'Official Stanford project framework used as a methodological benchmark.',
    'Stanford CS229 project framework.'
  )
on conflict (slug) do update set
  title=excluded.title,
  author=excluded.author,
  institution_or_publisher=excluded.institution_or_publisher,
  publication_year=excluded.publication_year,
  source_kind=excluded.source_kind,
  external_url=excluded.external_url,
  access_note=excluded.access_note,
  citation_note=excluded.citation_note,
  active=true;

update public.sds_reading_units u
set source_id=s.id
from public.sds_reading_sources s
where
  (u.slug='ml-fundamentals-first-weeks' and s.slug='mit-6036-official')
  or (u.slug='ml-advanced-first-weeks' and s.slug='mit-6s191-official')
  or (u.slug='unsupervised-first-weeks' and s.slug='stanford-cs229-unsupervised-official')
  or (u.slug='cybersecurity-first-weeks' and s.slug='harvard-cs50-cybersecurity-official')
  or (u.slug='thesis-first-weeks' and s.slug='stanford-cs229-projects-official');

with src as (select id from public.sds_reading_sources where slug='mit-6036-official'),
     u as (select id from public.sds_reading_units where slug='ml-fundamentals-first-weeks')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Formulate the learning problem','MIT 6.036 Course Description',
   'MIT frames introductory machine learning around modeling and prediction, beginning with the formulation of learning problems rather than with a catalogue of algorithms.',
   array['problem formulation','modeling','prediction']),
  (2,'Representation','MIT 6.036 Course Description',
   'Representation is treated as a core design decision: what information is available to the learner and how inputs are encoded strongly shape what can be learned.',
   array['representation','features','hypothesis']),
  (3,'Over-fitting and generalization','MIT 6.036 Course Description',
   'The course explicitly highlights over-fitting and generalization. Training performance alone is therefore not sufficient evidence that a model will work on unseen data.',
   array['overfitting','generalization','validation']),
  (4,'Learning families','MIT 6.036 / 6.390 overview',
   'The broader MIT introduction connects classification, regression, clustering, sequence learning and reinforcement learning under the common problem of learning predictive structure from data.',
   array['classification','regression','clustering','sequence learning'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  reading_unit_id=excluded.reading_unit_id,
  heading=excluded.heading,
  content_note=excluded.content_note,
  keywords=excluded.keywords;

with src as (select id from public.sds_reading_sources where slug='mit-6s191-official'),
     u as (select id from public.sds_reading_units where slug='ml-advanced-first-weeks')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Deep learning foundations','MIT 6.S191 Course Description',
   'MIT 6.S191 is an introductory deep-learning course designed to build foundational knowledge of deep-learning algorithms and practical experience constructing neural networks.',
   array['deep learning','neural networks','foundations']),
  (2,'Mathematical prerequisites','MIT 6.S191 Course Description',
   'The course assumes calculus, especially derivatives, and linear algebra, especially matrix multiplication. These prerequisites connect directly to gradient-based learning and neural-network computation.',
   array['calculus','derivatives','linear algebra','matrix multiplication']),
  (3,'From algorithms to applications','MIT 6.S191 Course Description',
   'The course places neural-network methods in application domains such as computer vision, natural language processing and biology, emphasizing transfer from algorithmic foundations to real problems.',
   array['computer vision','NLP','applications','transfer']),
  (4,'Build, do not only recognize','MIT 6.S191 Course Description',
   'Practical experience building neural networks is part of the course design. For SÓCRATES, this means an advanced-learning mission should include implementation or derivation evidence, not passive recognition.',
   array['implementation','TensorFlow','practice','evidence'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  reading_unit_id=excluded.reading_unit_id,
  heading=excluded.heading,
  content_note=excluded.content_note,
  keywords=excluded.keywords;

with src as (select id from public.sds_reading_sources where slug='stanford-cs229-unsupervised-official'),
     u as (select id from public.sds_reading_units where slug='unsupervised-first-weeks')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'K-means and cluster prototypes','Stanford CS229 Unsupervised Learning syllabus/materials',
   'Stanford CS229 treats k-means as a core unsupervised method for grouping observations around learned cluster centers. The choice of representation and distance directly shapes the resulting clusters.',
   array['k-means','centroid','distance','clustering']),
  (2,'Gaussian mixtures and EM','Stanford CS229 Unsupervised Learning syllabus/materials',
   'Gaussian mixture models introduce soft probabilistic cluster membership, while expectation-maximization alternates between estimating latent assignments and updating model parameters.',
   array['GMM','EM','latent variable','mixture model']),
  (3,'Factor analysis','Stanford CS229 Unsupervised Learning syllabus/materials',
   'Factor analysis models observed variation using a smaller number of latent factors plus noise, providing a probabilistic route to lower-dimensional structure.',
   array['factor analysis','latent factor','dimension reduction']),
  (4,'PCA and ICA','Stanford CS229 Unsupervised Learning syllabus/materials',
   'The unsupervised sequence includes principal components analysis and independent components analysis, two different ways to seek useful lower-dimensional representations of unlabeled data.',
   array['PCA','ICA','representation','unlabeled data'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  reading_unit_id=excluded.reading_unit_id,
  heading=excluded.heading,
  content_note=excluded.content_note,
  keywords=excluded.keywords;

with src as (select id from public.sds_reading_sources where slug='harvard-cs50-cybersecurity-official'),
     u as (select id from public.sds_reading_units where slug='cybersecurity-first-weeks')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Security is a trade-off','Harvard CS50 Cybersecurity — course overview',
   'Harvard frames cybersecurity as relative rather than absolute: decisions balance risks and rewards for an adversary against costs, benefits and usability for the defender.',
   array['risk','trade-off','usability','adversary']),
  (2,'Securing accounts','Harvard CS50 Cybersecurity — Week 0 / Lecture 0',
   'The course begins with account security before moving to data, systems, software and privacy. This is a useful threat-modeling pattern: start from the protected asset and its access boundary.',
   array['accounts','authentication','threat model','access']),
  (3,'Securing data','Harvard CS50 Cybersecurity — Week 1 / Lecture 1',
   'The data-security unit covers passwords, hashing, salting, ciphers, keys, public-key cryptography, digital signatures, passkeys and encryption in transit.',
   array['hashing','salting','encryption','public key','digital signature']),
  (4,'Course learning loop','Harvard CS50 Cybersecurity — course workflow',
   'The public course explicitly couples lecture material with assignments inspired by real-world events. SÓCRATES mirrors this by requiring application evidence after reading.',
   array['assignment','application','real-world','evidence'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  reading_unit_id=excluded.reading_unit_id,
  heading=excluded.heading,
  content_note=excluded.content_note,
  keywords=excluded.keywords;

with src as (select id from public.sds_reading_sources where slug='stanford-cs229-projects-official'),
     u as (select id from public.sds_reading_units where slug='thesis-first-weeks')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Four-deliverable research rhythm','Stanford CS229 Project Framework',
   'Stanford structures the term project as proposal, milestone, poster and final report. This creates a useful evidence cadence: define the question, demonstrate progress, communicate the result, then document the complete work.',
   array['proposal','milestone','poster','final report']),
  (2,'Technical quality','Stanford CS229 Project Evaluation',
   'Project evaluation emphasizes whether the technical material makes sense, whether attempted methods are reasonable, and whether the work conveys meaningful insight about the problem or algorithms.',
   array['technical quality','method','evaluation','insight']),
  (3,'Significance and scope','Stanford CS229 Project Evaluation',
   'A strong project must be significant enough for its scope rather than merely execute a standard recipe. SÓCRATES should therefore ask what new decision, evidence or insight the thesis produces.',
   array['significance','scope','research question','contribution']),
  (4,'Method freedom with accountability','Stanford CS229 Project FAQ',
   'The project framework does not restrict learners to methods taught in the class. This supports cross-course transfer, but the chosen method still needs to be justified and communicated clearly.',
   array['method choice','cross-course transfer','justification'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  reading_unit_id=excluded.reading_unit_id,
  heading=excluded.heading,
  content_note=excluded.content_note,
  keywords=excluded.keywords;
