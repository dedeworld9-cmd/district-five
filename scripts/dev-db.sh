#!/usr/bin/env bash
# Rebuilds the local development database with migrations, seed and test personas.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-d5dev}
PSQL="psql -X -q -t -v ON_ERROR_STOP=1 -d $DB"
dropdb --if-exists "$DB"; createdb "$DB"
$PSQL -f supabase/tests/00_stub_auth.sql
for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f supabase/seed.sql
$PSQL -f scripts/dev-seed.sql
echo "dev database $DB ready"
