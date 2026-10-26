#!/usr/bin/env bash
# Two reviewers press Approve on the same log at the same moment.
# Exactly one must win; the other must get D5409 after the first commits.
set -euo pipefail
DB=${DB:-d5test}
q() { psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
SHIFT=$(q -c "select tst.become('dual'); set role authenticated;
  select (public.save_shift_log(null, 'bcso', date_trunc('hour', now()) - interval '30 hours', date_trunc('hour', now()) - interval '29 hours', 0,
          'patrol', '[TEST] race', null, null, 'not_applicable', null, true)).id;" | tail -1)
( q -c "select tst.become('bcso_sup'); set role authenticated; begin;
        select (public.decide_shift_log('$SHIFT', 'approve')).status; select pg_sleep(2); commit;" > /tmp/d5_race_a 2>&1 || true ) &
sleep 0.5
q -c "select tst.become('bcso_sup2'); set role authenticated; select (public.decide_shift_log('$SHIFT', 'approve')).status;" > /tmp/d5_race_b 2>&1 || true
wait
grep -q approved /tmp/d5_race_a || { echo "FAIL: first reviewer did not win"; cat /tmp/d5_race_a; exit 1; }
grep -q "already approved" /tmp/d5_race_b || { echo "FAIL: second reviewer was not refused"; cat /tmp/d5_race_b; exit 1; }
N=$(q -c "select count(*) from public.approval_actions where record_id = '$SHIFT' and action = 'approved'")
[ "$N" = 1 ] || { echo "FAIL: $N approvals recorded"; exit 1; }
echo "ok  concurrent reviewers: one approval, second refused with D5409"
