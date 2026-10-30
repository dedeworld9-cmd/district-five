-- Office of the Sheriff: the Chief Deputy and both Majors sit with the Sheriff and Undersheriff on the
-- roster sheet (1S-01 to 1S-05), so they take the department_head tier. Re-runnable.
--   * Rank ladder: Major and Chief Deputy move from high_command to department_head.
--   * Existing members holding those ranks follow their rank.
--   * Department heads have no higher tier to review their paperwork at HCSO, so each record type routes
--     to another department head. The database already stops anyone deciding their own record.
-- Only DPS or a site administrator can appoint at this tier (unchanged rule).

update public.ranks set tier = 'department_head'
where department_key = 'hcso' and name in ('Major', 'Chief Deputy') and tier <> 'department_head';

update public.memberships m set tier = 'department_head'
from public.ranks r
where m.rank_id = r.id and r.department_key = 'hcso' and r.name in ('Major', 'Chief Deputy') and m.tier <> 'department_head';

insert into public.approval_routes (record_type, department_key, submitter_tier, required_tier)
select t, 'hcso', 'department_head', 'department_head'
from unnest(array['shift_log', 'incident', 'arrest', 'citation', 'use_of_force', 'ois', 'cad_report', 'evidence_log',
  'warrant', 'bolo', 'certification', 'subdivision', 'leave', 'fto_log', 'office_request', 'roster_update',
  'vehicle_reg', 'firearm_reg', 'confiscation', 'agreement', 'suggestion']) as t
on conflict (record_type, department_key, submitter_tier) do nothing;
