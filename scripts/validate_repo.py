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

print('SÓCRATES DS repository validation passed.')
print(f'Validated {len(courses)} canonical courses, Reading Room, retrieval contract and AI grounding safeguards.')
