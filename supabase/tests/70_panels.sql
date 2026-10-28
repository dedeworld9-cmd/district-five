-- Department panels: department heads administer their own department only.

select tst.become('bcso_head');
set role authenticated;
select tst.ok(public.can_administer('bcso') and not public.can_administer('sahp'), 'head: administers own department only');
select tst.ok((public.admin_update_department('bcso', 600, null, null, null, null, null)).quota_minutes = 600, 'head: sets own quota');
select tst.fails($$select public.admin_update_department('sahp', 600, null, null, null, null, null)$$, 'D5403', 'head: cannot change another department');
select (public.admin_save_rank(null, 'bcso', '[TEST] Reserve Deputy', 'RD', 'patrol', 5, true)).id as rk \gset
select tst.ok((select department_key from public.ranks where id = :'rk') = 'bcso', 'head: adds a rank');
select tst.fails($$select public.admin_save_rank(null, 'bcso', '[TEST] Boss', null, 'dps', 500, true)$$, 'D5403', 'head: cannot create a division command rank');
select tst.fails(format('select public.admin_save_rank(%L, %L, %L, null, %L, 1, true)', (select id from public.ranks where department_key = 'sahp' limit 1), 'bcso', 'Hijack', 'patrol'),
                 'D5403', 'head: cannot edit another department''s rank by id');
select tst.fails($$select public.admin_save_route('shift_log', null, 'patrol', 'high_command')$$, 'D5403', 'head: cannot change the district default route');
select public.admin_save_route('shift_log', 'bcso', 'patrol', 'high_command');
select tst.ok((select required_tier from public.approval_routes where department_key = 'bcso' and submitter_tier = 'patrol') = 'high_command', 'head: sets own route');
select tst.ok((public.admin_save_option(null, 'bcso', 'certification', '[TEST] K9', null, 'patrol', true, 1)).department_key = 'bcso', 'head: adds a certification');
reset role;

select tst.become('bcso_hc');
set role authenticated;
select tst.ok(not public.can_administer('bcso'), 'high command: no administration panel');
select tst.fails($$select public.admin_update_department('bcso', 60, null, null, null, null, null)$$, 'D5403', 'high command: cannot change settings');
reset role;

select tst.become('bcso_sup');
set role authenticated;
select tst.fails($$select public.admin_save_option(null, 'bcso', 'certification', '[TEST] Nope', null, 'patrol', true, 1)$$, 'D5403', 'supervisor: cannot add options');
reset role;

select tst.become('dps_user');
set role authenticated;
select tst.ok(public.can_administer('bcso') and public.can_administer('sahp'), 'division command: administers its departments');
reset role;

-- DPS patrol: division command files its own division's reports, reviewed by division command.
select tst.become('dps_user');
set role authenticated;
select (public.save_submission(null, 'citation', 'dps', '{"suspect_name":"[TEST] Driver","violations":"Speeding","fine":"500"}', null, current_date, null, null, false)).id as dps_cit \gset
select tst.ok((select required_tier from public.submissions where id = :'dps_cit') = 'dps', 'dps patrol: report routes to division command');
select tst.fails(format('select public.decide_submission(%L, %L)', :'dps_cit', 'approve'), 'D5403', 'dps patrol: cannot review own report');
select tst.fails($$select public.save_submission(null, 'fire_incident', 'dps', '{}', null, current_date, null, null, false)$$, 'D5422', 'dps patrol: only law enforcement paperwork');
reset role;

-- Personnel notes: high command writes on members below it.
select tst.become('bcso_hc');
set role authenticated;
select tst.ok((public.add_personnel_note((select id from public.memberships where profile_id = tst.id('bcso_mem') and department_key = 'bcso'),
  'commendation', '[TEST] Great pursuit', 'Kept it safe', null)).category = 'commendation', 'high command: writes a commendation');
select tst.fails(format('select public.add_personnel_note(%L, %L, %L, null, null)', (select id from public.memberships where profile_id = tst.id('bcso_head') and department_key = 'bcso'), 'disciplinary', '[TEST] Nope'),
  'D5403', 'high command: cannot write on the sheriff');
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.fails(format('select public.add_personnel_note(%L, %L, %L, null, null)', (select id from public.memberships where profile_id = tst.id('bcso_mem') and department_key = 'bcso'), 'note', '[TEST] Nope'),
  'D5403', 'supervisor: cannot write personnel entries');
reset role;
