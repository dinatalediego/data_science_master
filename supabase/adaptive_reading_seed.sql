-- SÓCRATES DS V0.7 — source-grounded first-weeks knowledge pack
-- Notes are concise paraphrases with explicit locators; no long passages are reproduced.

-- Map reading units to concepts so completion can schedule spaced retrieval.
with m(unit_slug, concept_key, role, weight) as (values
  ('forecasting-dependence-stationarity','stationarity','core',1.0::numeric),
  ('forecasting-dependence-stationarity','autocorrelation','extension',0.7::numeric),
  ('forecasting-lag-operator','stationarity','prerequisite',0.8::numeric),
  ('forecasting-lag-operator','arima-state-space','core',1.0::numeric),
  ('forecasting-stationary-arma','stationarity','core',1.0::numeric),
  ('forecasting-stationary-arma','autocorrelation','core',1.0::numeric),
  ('forecasting-stationary-arma','arima-state-space','core',1.0::numeric),
  ('forecasting-first-forecast','forecast-evaluation','core',1.0::numeric),
  ('forecasting-first-forecast','time-series-validation','core',0.9::numeric),
  ('forecasting-first-forecast','arima-state-space','extension',0.7::numeric),

  ('math-matrix-actions','vectors-matrices','core',1.0::numeric),
  ('math-subspaces-elimination-orthogonality','vectors-matrices','core',1.0::numeric),
  ('math-eigen-svd-pca','vectors-matrices','prerequisite',0.8::numeric),
  ('math-eigen-svd-pca','pca','core',1.0::numeric),

  ('ml-fundamentals-first-weeks','train-validation-test','core',1.0::numeric),
  ('ml-fundamentals-first-weeks','bias-variance','core',0.9::numeric),
  ('ml-fundamentals-first-weeks','data-leakage','core',0.9::numeric),

  ('ml-advanced-first-weeks','neural-networks','core',1.0::numeric),
  ('ml-advanced-first-weeks','backpropagation','core',1.0::numeric),
  ('ml-advanced-first-weeks','hyperparameter-tuning','extension',0.6::numeric),

  ('unsupervised-first-weeks','distance-similarity','prerequisite',0.8::numeric),
  ('unsupervised-first-weeks','clustering','core',1.0::numeric),
  ('unsupervised-first-weeks','pca','core',1.0::numeric),

  ('cybersecurity-first-weeks','ai-threat-model','core',1.0::numeric),
  ('cybersecurity-first-weeks','privacy-governance','core',0.8::numeric),
  ('cybersecurity-first-weeks','adversarial-robustness','extension',0.6::numeric),

  ('thesis-first-weeks','research-question','core',1.0::numeric),
  ('thesis-first-weeks','research-design','core',1.0::numeric),
  ('thesis-first-weeks','reproducibility','core',0.9::numeric)
)
insert into public.sds_reading_unit_concepts(reading_unit_id, concept_id, role, weight)
select u.id, c.id, m.role, m.weight
from m
join public.sds_reading_units u on u.slug=m.unit_slug
join public.sds_concepts c on c.canonical_key=m.concept_key
on conflict (reading_unit_id, concept_id) do update set
  role=excluded.role,
  weight=excluded.weight;

-- MIT 14.384 Lecture 1
with src as (select id from public.sds_reading_sources where slug='mit-14384-lecture1'),
     u as (select id from public.sds_reading_units where slug='forecasting-dependence-stationarity')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Why dependence matters','MIT 14.384 Lecture 1, p. 1',
   'Time-series data differ from cross-sectional i.i.d. data because observations depend on earlier observations. That dependence complicates standard inference but is also what makes forecasting possible.',
   array['dependence','time series','cross section','forecasting','inference']),
  (2,'Stationarity as stability','MIT 14.384 Lecture 1, p. 2',
   'The lecture motivates stationarity as a stability condition needed to use observed history for statements about the future. Strict stationarity keeps joint distributions invariant to time shifts; weak stationarity keeps first and second moments time-invariant.',
   array['strict stationarity','weak stationarity','moments','stability']),
  (3,'Nonstationary counterexamples','MIT 14.384 Lecture 1, p. 2',
   'A structural break changes the mean after a date, while a random walk accumulates shocks so its variance grows over time. Both illustrate failures of time-invariant second moments.',
   array['random walk','unit root','break','variance','nonstationary']),
  (4,'Lag operator','MIT 14.384 Lecture 1, pp. 2–3',
   'The lag operator L shifts a series one period: L y_t = y_{t-1}. Powers shift multiple periods, and polynomials in L compactly represent dynamic equations.',
   array['lag operator','polynomial','L','dynamic equation'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

-- Hamilton Chapter 2: lag operators
with src as (select id from public.sds_reading_sources where slug='hamilton-time-series-analysis'),
     u as (select id from public.sds_reading_units where slug='forecasting-lag-operator')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Time-series operators','Hamilton, Ch. 2 §2.1, pp. 25–26',
   'Hamilton frames a time series as a sequence indexed by date and defines operators as transformations from one sequence to another. Addition and scalar multiplication act element by element.',
   array['operator','sequence','time series']),
  (2,'The lag operator as algebra','Hamilton, Ch. 2 §2.1, pp. 26–27',
   'Applying L once replaces x_t by x_{t-1}; applying L^k shifts k periods. L commutes with scalar multiplication and distributes over addition, which lets lag polynomials be manipulated using familiar algebraic rules.',
   array['lag operator','commutative','distributive','lag polynomial']),
  (3,'Polynomial representation','Hamilton, Ch. 2, pp. 27–34',
   'Dynamic equations can be written as polynomials in L. Factoring the lag polynomial exposes characteristic roots and provides a compact route from difference-equation dynamics to time-series representations.',
   array['lag polynomial','roots','difference equation','factorization']),
  (4,'Stable inversion intuition','Hamilton, Ch. 2, pp. 34–42',
   'When the relevant dynamic roots imply a stable solution, inverse lag-polynomial expansions express current values as weighted sums of present and past shocks. This representation is foundational for stationary AR processes.',
   array['inverse','stability','roots','infinite representation'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

-- Hamilton Chapter 3: stationary ARMA
with src as (select id from public.sds_reading_sources where slug='hamilton-time-series-analysis'),
     u as (select id from public.sds_reading_units where slug='forecasting-stationary-arma')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Expectations and stationarity','Hamilton, Ch. 3 §3.1, pp. 43–47',
   'Hamilton begins stationary ARMA analysis from probability distributions, unconditional means, variances and autocovariances. A deterministic time trend changes the unconditional mean with t and therefore conflicts with covariance stationarity.',
   array['expectation','mean','variance','stationarity','autocovariance']),
  (2,'White noise and moving averages','Hamilton, Ch. 3 §§3.2–3.3, pp. 47–53',
   'White noise supplies serially uncorrelated innovations. Moving-average processes combine current and lagged innovations, producing finite memory in the dependence structure.',
   array['white noise','MA','innovation','finite memory']),
  (3,'Autoregressive processes','Hamilton, Ch. 3 §3.4, pp. 53–59',
   'Autoregressive processes relate the current observation to its own lags plus an innovation. Stationarity is tied to stable lag-polynomial roots, which allow a causal infinite moving-average representation.',
   array['AR','autoregressive','stationarity','causal','roots']),
  (4,'ARMA and invertibility','Hamilton, Ch. 3 §§3.5–3.7, pp. 59–71',
   'ARMA combines autoregressive and moving-average terms. Invertibility asks whether innovations can be recovered from the observed series through a stable autoregressive representation; it is conceptually distinct from stationarity.',
   array['ARMA','invertibility','innovation','stationarity']),
  (5,'Autocovariance structure','Hamilton, Ch. 3, pp. 43–71',
   'Autocovariances summarize how observations separated by a lag move together. Their pattern is a key diagnostic signature of stationary linear processes and connects model parameters to observable serial dependence.',
   array['autocovariance','autocorrelation','lag','serial dependence'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

-- Hamilton Chapter 4: forecasting
with src as (select id from public.sds_reading_sources where slug='hamilton-time-series-analysis'),
     u as (select id from public.sds_reading_units where slug='forecasting-first-forecast')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Forecasting objective','Hamilton, Ch. 4 intro, p. 72',
   'The chapter moves from describing a stochastic process to forecasting it. It distinguishes theoretical forecasts with an infinite history from practical forecasts based on a finite observed sample.',
   array['forecasting','finite sample','ARMA']),
  (2,'Conditional expectation and MSE','Hamilton, Ch. 4 §4.1, pp. 72–73',
   'Under quadratic loss, the conditional expectation of the future variable given current information minimizes mean squared forecast error among all forecasting rules.',
   array['conditional expectation','MSE','quadratic loss','optimal forecast']),
  (3,'Linear projection','Hamilton, Ch. 4 §4.1, pp. 73–75',
   'Restricting forecasts to linear functions leads to the linear projection. Its forecast error is orthogonal to the information variables and it minimizes mean squared error within the class of linear forecasting rules.',
   array['linear projection','orthogonality','forecast error','MSE']),
  (4,'Updating and Wold perspective','Hamilton, Ch. 4 §§4.5–4.8, pp. 92–116',
   'Later sections show how forecasts update as new information arrives and connect covariance-stationary processes to moving-average representations through Wold decomposition and the Box–Jenkins modeling philosophy.',
   array['forecast updating','Wold','Box Jenkins','MA infinity'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

-- Strang: Ax, subspaces, SVD/PCA
with src as (select id from public.sds_reading_sources where slug='strang-linear-algebra-learning-data'),
     u as (select id from public.sds_reading_units where slug='math-matrix-actions')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Ax as a combination of columns','Strang, Part I §1.1, pp. 2–5',
   'Strang emphasizes the vector view of matrix multiplication: Ax is a linear combination of the columns of A. This viewpoint leads directly to the column space and to the solvability question for Ax=b.',
   array['Ax','columns','linear combination','column space']),
  (2,'Rank and basis','Strang, Part I §1.1, pp. 4–8',
   'Independent columns form a basis for the column space. The number of independent columns is the rank, which is also the dimension of the column space.',
   array['rank','basis','independence','dimension']),
  (3,'Matrix multiplication as composition','Strang, Part I §1.2, pp. 9–13',
   'Matrix-matrix multiplication can be read columnwise: each column of AB is A times the corresponding column of B. This makes AB the composition of two linear actions rather than only a table of dot products.',
   array['AB','composition','matrix multiplication','columns'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

with src as (select id from public.sds_reading_sources where slug='strang-linear-algebra-learning-data'),
     u as (select id from public.sds_reading_units where slug='math-subspaces-elimination-orthogonality')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Four fundamental subspaces','Strang, Part I §1.3, pp. 14–20',
   'The column space, row space, nullspace and left nullspace organize what a matrix can produce, what inputs it loses, and how rank is shared across rows and columns.',
   array['column space','row space','nullspace','left nullspace','rank']),
  (2,'Elimination and LU','Strang, Part I §1.4, pp. 21–28',
   'Elimination is represented as matrix factorization. A=LU separates the elimination steps from the resulting triangular system and turns a solving procedure into reusable linear algebra structure.',
   array['elimination','LU','triangular','factorization']),
  (3,'Orthogonality','Strang, Part I §1.5, pp. 29–35',
   'Orthogonality creates stable decompositions and geometric projection ideas. Orthogonal matrices preserve lengths and angles, while orthogonal subspaces clarify least-squares residuals.',
   array['orthogonality','projection','orthogonal matrix','least squares'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

with src as (select id from public.sds_reading_sources where slug='strang-linear-algebra-learning-data'),
     u as (select id from public.sds_reading_units where slug='math-eigen-svd-pca')
insert into public.sds_source_chunks(source_id,reading_unit_id,sequence,heading,locator,content_note,keywords)
select src.id,u.id,x.sequence,x.heading,x.locator,x.content_note,x.keywords
from src,u,(values
  (1,'Eigenvectors and positive definite structure','Strang, Part I §§1.6–1.7, pp. 36–55',
   'Eigenvectors identify directions that a square matrix preserves up to scaling. For symmetric positive definite matrices, eigenvalues are positive and eigenvectors can be chosen orthogonal, making spectral structure especially interpretable.',
   array['eigenvalue','eigenvector','positive definite','symmetric']),
  (2,'SVD works for every matrix','Strang, Part I §1.8, pp. 56–70',
   'The singular value decomposition uses right singular vectors, left singular vectors and nonnegative singular values. It applies to rectangular matrices and decomposes A into ordered rank-one pieces.',
   array['SVD','singular value','left singular vector','right singular vector']),
  (3,'Best low-rank approximation','Strang, Part I §§1.8–1.9, pp. 58–75',
   'The leading singular-value terms are ordered by importance. Truncating after k terms gives the best rank-k approximation in the sense described by the Eckart–Young theorem.',
   array['Eckart Young','rank k','approximation','singular values']),
  (4,'PCA from centered data','Strang, Part I §1.9, pp. 75–80',
   'PCA begins by centering each measured variable. Principal directions are tied to the leading left singular vectors of the centered data matrix, equivalently the leading eigenvectors of its covariance matrix.',
   array['PCA','centering','covariance','principal component','variance'])
) as x(sequence,heading,locator,content_note,keywords)
on conflict (source_id,locator,sequence) do update set
  heading=excluded.heading,content_note=excluded.content_note,keywords=excluded.keywords,reading_unit_id=excluded.reading_unit_id;

-- More baseline artifacts so every source-grounded route has more than a single static summary.
with u as (select id from public.sds_reading_units where slug='forecasting-stationary-arma')
insert into public.sds_reading_artifacts(reading_unit_id,artifact_type,title,content)
select id,'concept_cards','Concept cards — AR / MA / ARMA',
jsonb_build_object(
  'cards',jsonb_build_array(
    'AR: current value depends on own lags plus an innovation.',
    'MA: current value is built from current and lagged innovations.',
    'ARMA: combines AR and MA terms in a compact stationary model.',
    'Stationarity: asks whether the process has stable probabilistic moments over time.',
    'Invertibility: asks whether innovations can be stably recovered from observations.'
  ),
  'contrast','Stationarity and invertibility answer different questions; do not treat them as synonyms.'
) from u
on conflict do nothing;

with u as (select id from public.sds_reading_units where slug='forecasting-first-forecast')
insert into public.sds_reading_artifacts(reading_unit_id,artifact_type,title,content)
select id,'summary','One-page brief — What makes a forecast optimal?',
jsonb_build_object(
  'thesis','With quadratic loss, conditional expectation minimizes MSE among all forecasts; linear projection is optimal within linear forecasting rules.',
  'ideas',jsonb_build_array(
    'Define the information available at forecast time.',
    'Choose the loss function before declaring one forecast better than another.',
    'Forecast error orthogonality is the signature of a linear projection.',
    'Finite samples require practical approximations to theoretical infinite-history formulas.'
  ),
  'transfer',jsonb_build_array(
    'State what information set your production forecast actually had.',
    'Never evaluate with information that would not have existed at forecast time.'
  )
) from u
on conflict do nothing;

with u as (select id from public.sds_reading_units where slug='math-matrix-actions')
insert into public.sds_reading_artifacts(reading_unit_id,artifact_type,title,content)
select id,'concept_cards','Concept cards — Matrix actions',
jsonb_build_object(
  'cards',jsonb_build_array(
    'Ax: a weighted combination of A’s columns.',
    'Column space: every output vector Ax that A can produce.',
    'Ax=b solvable ⇔ b lies in the column space.',
    'Rank: number of independent columns; dimension of the column space.',
    'AB: composition of the action of B followed by the action of A.'
  )
) from u
on conflict do nothing;

with u as (select id from public.sds_reading_units where slug='math-eigen-svd-pca')
insert into public.sds_reading_artifacts(reading_unit_id,artifact_type,title,content)
select id,'practice_set','Practice set — SVD and PCA transfer',
jsonb_build_object(
  'prompts',jsonb_build_array(
    'Explain why eigenvectors are not enough for a rectangular data matrix.',
    'Given descending singular values, argue what is lost when keeping only the first k terms.',
    'Explain why centering matters before PCA.',
    'Connect the leading principal component to a direction of high variance.',
    'Describe one business dataset where a low-rank approximation could be useful and what information it would intentionally discard.'
  )
) from u
on conflict do nothing;
