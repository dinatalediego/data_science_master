from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    'README.md',
    'ARCHITECTURE.md',
    'config/courses.json',
    'docs/CAMPUS_SPEC.md',
    'docs/DOMAIN_MODEL.md',
    'docs/LEARNING_CONSTITUTION.md',
    'docs/ROADMAP.md',
    'supabase/migrations/0001_socrates_foundation.sql',
    'supabase/migrations/0003_reading_companion.sql',
    'supabase/migrations/0004_adaptive_reading_ai.sql',
    'supabase/migrations/0005_private_reading_ingestion.sql',
    'supabase/migrations/0006_persistent_study_packs.sql',
    'supabase/migrations/0007_next_best_action_engine.sql',
    'supabase/migrations/0008_reinforcement_engine.sql',
    'supabase/migrations/0009_ai_evidence_evaluator.sql',
    'supabase/migrations/0010_weekly_learning_review.sql',
    'supabase/migrations/0011_intervention_effectiveness_memory.sql',
    'supabase/migrations/0012_precycle_readiness.sql',
    'docs/PRECYCLE_READINESS.md',
    'docs/ACADEMIC_WEEK_INTELLIGENCE.md',
    'components/PreCycleLaunchpad.tsx',
    'docs/REINFORCEMENT_ENGINE.md',
    'docs/INTERVENTION_EFFECTIVENESS_MEMORY.md',
    'docs/WEEKLY_LEARNING_REVIEW.md',
    'components/WeeklyReviewPanel.tsx',
    'lib/weeklyReview.ts',
    'docs/AI_EVIDENCE_EVALUATOR.md',
    'app/api/tutor-evaluate/route.ts',
    'components/ReinforcementPanel.tsx',
    'lib/learningActions.ts',
    'supabase/reading_companion_seed.sql',
    'supabase/adaptive_reading_seed.sql',
    'components/ReadingRoomPanel.tsx',
    'components/ReadingCoachPanel.tsx',
    'components/ReadingUploadPanel.tsx',
    'app/api/reading-ingest/route.ts',
    'app/api/study-pack/route.ts',
    'components/StudyPackPanel.tsx',
    'app/api/reading-coach/route.ts',
    'supabase/seed.sql',
]

def fail(message: str) -> None:
    raise SystemExit(f'VALIDATION FAILED: {message}')

for rel in REQUIRED_FILES:
    if not (ROOT / rel).exists():
        fail(f'missing required file: {rel}')

payload = json.loads((ROOT / 'config/courses.json').read_text(encoding='utf-8'))
courses = payload.get('courses', [])

if len(courses) != 7:
    fail(f'expected exactly 7 courses, found {len(courses)}')

slugs = [c.get('slug') for c in courses]
if len(slugs) != len(set(slugs)):
    fail('course slugs must be unique')

if any('visualiz' in c.get('name', '').lower() for c in courses):
    fail('Visualización de Datos must not be included in the seven-course catalog')

required_slugs = {
    'forecasting-for-data-science',
    'ml-supervisado-advanced',
    'ciberseguridad-ia',
    'matematica-ml-ia',
    'ml-supervisado-fundamentals',
    'ml-no-supervisado',
    'proyecto-integrador-tesis',
}

if set(slugs) != required_slugs:
    fail(f'course slug set differs from canonical catalog: {set(slugs) ^ required_slugs}')

term = payload.get('academic_term', {})
if term.get('nominal_start') != '2026-09-28':
    fail('academic term nominal_start must be 2026-09-28')
if term.get('nominal_end') != '2027-01-30':
    fail('academic term nominal_end must be 2027-01-30')
if term.get('week_count') != 18:
    fail('academic term must preserve 18 weeks')

def minutes(value: str) -> int:
    h, m = map(int, value.split(':'))
    return h * 60 + m

def overlap(a: dict, b: dict) -> bool:
    sa, ea = a['schedule'], b['schedule']
    if sa['day_of_week'] != ea['day_of_week']:
        return False
    return max(minutes(sa['start']), minutes(ea['start'])) < min(minutes(sa['end']), minutes(ea['end']))

by_slug = {c['slug']: c for c in courses}
if not overlap(by_slug['forecasting-for-data-science'], by_slug['ml-supervisado-advanced']):
    fail('expected Monday overlap between Forecasting and ML Supervisado Advanced')

math_course = by_slug['matematica-ml-ia']
if math_course['schedule'] != {'day': 'Wednesday', 'day_of_week': 3, 'start': '19:00', 'end': '22:00'}:
    fail('Matemática para ML e IA schedule must remain Wednesday 19:00–22:00')

adaptive_seed = (ROOT / 'supabase/adaptive_reading_seed.sql').read_text(encoding='utf-8')
for required_source in ['hamilton-time-series-analysis', 'strang-linear-algebra-learning-data', 'mit-14384-lecture1']:
    if required_source not in adaptive_seed:
        fail(f'missing source-grounded seed: {required_source}')

api_route = (ROOT / 'app/api/reading-coach/route.ts').read_text(encoding='utf-8')
for contract in [
    'Use ONLY the evidence supplied in the prompt',
    'groundingStatus',
    'sds_search_reading_chunks',
    'disallowPromptTraining',
]:
    if contract not in api_route:
        fail(f'AI reading contract missing: {contract}')

ingest_route = (ROOT / 'app/api/reading-ingest/route.ts').read_text(encoding='utf-8')
for contract in ['sds-readings', 'storagePath', 'source_hash', 'Private PDF']:
    if contract not in ingest_route:
        fail(f'private ingestion contract missing: {contract}')

study_pack_route = (ROOT / 'app/api/study-pack/route.ts').read_text(encoding='utf-8')
for contract in ['sds_user_study_packs', 'source_locators', 'Use only the supplied evidence', 'disallowPromptTraining']:
    if contract not in study_pack_route:
        fail(f'Study Pack grounding contract missing: {contract}')

nba_sql = (ROOT / 'supabase/migrations/0007_next_best_action_engine.sql').read_text(encoding='utf-8')
for contract in [
    'sds_next_best_learning_actions',
    'due_reviews',
    'sds_learning_action_events',
    'weak_mastery',
]:
    if contract.lower() not in nba_sql.lower():
        fail(f'Next-Best Action contract missing: {contract}')

reinforcement_sql = (ROOT / 'supabase/migrations/0008_reinforcement_engine.sql').read_text(encoding='utf-8')
for contract in [
    'sds_learning_action_state',
    'sds_snooze_learning_action',
    'sds_calibration_profile',
    'sds_reinforcement_snapshot',
    'deferral_rescue',
    'prerequisite_rescue',
    'calibration_actions',
]:
    if contract.lower() not in reinforcement_sql.lower():
        fail(f'Reinforcement contract missing: {contract}')

reinforcement_ui = (ROOT / 'components/ReinforcementPanel.tsx').read_text(encoding='utf-8')
for contract in [
    'Reinforcement Lab',
    'Posponer 24h',
    'Calibration gap',
    'prerrequisitos',
]:
    if contract.lower() not in reinforcement_ui.lower():
        fail(f'Reinforcement UI contract missing: {contract}')

evaluator_sql = (ROOT / 'supabase/migrations/0009_ai_evidence_evaluator.sql').read_text(encoding='utf-8')
for contract in [
    'sds_attempt_evaluations',
    'sds_attempt_effective_scores',
    'sds_calibration_profile_v2',
    'evaluator_confidence',
    'effective_score',
]:
    if contract.lower() not in evaluator_sql.lower():
        fail(f'AI evaluator SQL contract missing: {contract}')

evaluator_route = (ROOT / 'app/api/tutor-evaluate/route.ts').read_text(encoding='utf-8')
for contract in [
    'Evaluate a learner response ONLY against the supplied question and answer guide',
    'non-official',
    'evaluatorConfidence',
    'effectiveScoreSource',
    'disallowPromptTraining',
]:
    if contract not in evaluator_route:
        fail(f'AI evaluator API contract missing: {contract}')

tutor_ui = (ROOT / 'components/TutorPanel.tsx').read_text(encoding='utf-8')
for contract in [
    'AI EVIDENCE CONTRAST',
    'NO OFFICIAL GRADE',
    'effectiveScoreSource',
]:
    if contract not in tutor_ui:
        fail(f'Tutor evaluator UI contract missing: {contract}')

weekly_sql = (ROOT / 'supabase/migrations/0010_weekly_learning_review.sql').read_text(encoding='utf-8')
for contract in [
    'sds_weekly_learning_snapshot',
    'sds_weekly_course_evidence',
    'sds_weekly_learning_history',
    'sds_intervention_outcomes',
    'America/Lima',
    'Observational',
]:
    if contract.lower() not in weekly_sql.lower():
        fail(f'Weekly review SQL contract missing: {contract}')

weekly_ui = (ROOT / 'components/WeeklyReviewPanel.tsx').read_text(encoding='utf-8')
for contract in [
    'WEEKLY LEARNING REVIEW',
    'STOP DOING',
    'START DOING',
    'CONTINUE',
    'Observational',
    'Exportar portfolio .md',
]:
    if contract.lower() not in weekly_ui.lower():
        fail(f'Weekly review UI contract missing: {contract}')

memory_sql = (ROOT / 'supabase/migrations/0011_intervention_effectiveness_memory.sql').read_text(encoding='utf-8')
for contract in [
    'sds_intervention_effectiveness_profile',
    'sds_intervention_effectiveness_by_concept',
    'paired_outcomes >= 5',
    'never alter policy ranking',
    'caus',
]:
    if contract.lower() not in memory_sql.lower():
        fail(f'Intervention-memory SQL contract missing: {contract}')

memory_ui = (ROOT / 'components/WeeklyReviewPanel.tsx').read_text(encoding='utf-8')
for contract in [
    'PERSONAL LEARNING MEMORY',
    'Minimum gate',
    'no cambia el ranking',
    'causalidad',
]:
    if contract.lower() not in memory_ui.lower():
        fail(f'Intervention-memory UI contract missing: {contract}')

precycle_sql = (ROOT / 'supabase/migrations/0012_precycle_readiness.sql').read_text(encoding='utf-8')
for contract in [
    'sds_precycle_course_readiness',
    'baseline_missing',
    'source_grounded_pending_tasks',
    'has_schedule_conflict',
    'No course is declared',
]:
    if contract.lower() not in precycle_sql.lower():
        fail(f'Pre-cycle readiness SQL contract missing: {contract}')

precycle_ui = (ROOT / 'components/PreCycleLaunchpad.tsx').read_text(encoding='utf-8')
for contract in [
    'PRE-CYCLE LAUNCHPAD',
    'TOP 3',
    'No intentes',
    'conflicto horario',
    'Crear baseline',
]:
    if contract.lower() not in precycle_ui.lower():
        fail(f'Pre-cycle readiness UI contract missing: {contract}')

academic_term_ts = (ROOT / 'lib/academicTerm.ts').read_text(encoding='utf-8')
for contract in [
    'academicWeekSessionDate',
    'ACADEMIC_TERM.week_count',
    'endOfAcademicTerm',
]:
    if contract not in academic_term_ts:
        fail(f'Academic-week runtime contract missing: {contract}')

app_ui = (ROOT / 'components/SocratesApp.tsx').read_text(encoding='utf-8')
for contract in [
    'DATED AGENDA',
    'aria-pressed',
    'academicWeekSessionDate',
    'selectedAcademicWeek',
]:
    if contract not in app_ui:
        fail(f'Academic-week UI contract missing: {contract}')

print('SÓCRATES DS repository validation passed.')
print(f'Validated {len(courses)} canonical courses, academic term, grounding safeguards, reinforcement, evaluator, weekly review, personal memory, pre-cycle and V1.6 dated-week contracts.')
