#!/usr/bin/env bash
# Rebuilds a throwaway local database, applies every migration and the seed, then runs the SQL tests.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-d5test}
PSQL="psql -X -q -t -v ON_ERROR_STOP=1 -d $DB"
dropdb --if-exists "$DB"; createdb "$DB"
$PSQL -f supabase/tests/00_stub_auth.sql
for f in supabase/migrations/*.sql; do echo "== $f"; $PSQL -f "$f"; done
[ -f supabase/seed.sql ] && $PSQL -f supabase/seed.sql
for f in supabase/tests/[1-9]*; do echo "== $f"; case "$f" in *.sql) $PSQL -f "$f" ;; *.sh) DB=$DB bash "$f" ;; esac; done
echo "ALL OK"
