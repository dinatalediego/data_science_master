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

print('SÓCRATES DS repository validation passed.')
print(f'Validated {len(courses)} canonical courses and required foundation files.')
