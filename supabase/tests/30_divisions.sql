-- Division boundaries: Fire/EMS Administration commands SAFD and SAEMS only; DPS commands
-- every division; members of one division never read another division's records. Runs after
-- 10_personas.sql on the same database and reuses its tst helpers and people.

-- ------------------------------------------------------------ fixtures
-- Test-only ranks; the real Fire/EMS ladders are entered by an administrator.
insert into public.ranks (department_key, name, tier, sort_order) values
  ('safd', '[TEST] Firefighter', 'patrol', 10),
  ('safd', '[TEST] Lieutenant', 'supervisor', 20),
  ('safd', '[TEST] Fire Chief', 'department_head', 30),
  ('saems', '[TEST] EMT', 'patrol', 10),
  ('fems', '[TEST] Deputy Commissioner', 'dps', 10);

do $$
declare
  h text;
  u uuid;
  rk record;
  spec text[][] := array[
    ['safd_ff',    'safd',  '[TEST] Firefighter'],
    ['safd_lt',    'safd',  '[TEST] Lieutenant'],
    ['safd_chief', 'safd',  '[TEST] Fire Chief'],
    ['saems_emt',  'saems', '[TEST] EMT'],
    ['fems_cmd',   'fems',  '[TEST] Deputy Commissioner']];
  i int;
begin
  foreach h in array array['safd_ff','safd_lt','safd_chief','saems_emt','fems_cmd','safd_new'] loop
    insert into auth.users (email, raw_user_meta_data)
    values (h || '@example.test', jsonb_build_object('full_name', '[TEST] ' || h, 'provider_id', 'disc-' || h))
    returning id into u;
    insert into tst.people values (h, u);
  end loop;
  for i in 1 .. array_length(spec, 1) loop
    select * into rk from public.ranks where department_key = spec[i][2] and name = spec[i][3];
    insert into public.memberships (profile_id, display_name, department_key, rank_id, rank_name, tier, status, is_probationary, join_date, callsign)
    values (tst.id(spec[i][1]), '[TEST] ' || spec[i][1], spec[i][2], rk.id, rk.name, rk.tier, 'active', false, current_date - 30, 'FE-' || i);
  end loop;
  update public.memberships set can_view_personnel = true where profile_id = tst.id('fems_cmd');
end $$;

select id as safd_ff_m from public.memberships where profile_id = tst.id('safd_ff') \gset
select id as bcso_mem_m from public.memberships where profile_id = tst.id('bcso_mem') \gset
select id as head_rank from public.ranks where department_key = 'safd' and name = '[TEST] Fire Chief' \gset

-- ------------------------------------------------ firefighter logs a shift
select tst.become('safd_ff');
set role authenticated;
select (public.save_shift_log(null, 'safd', date_trunc('minute', now()) - interval '4 hours', date_trunc('minute', now()) - interval '2 hours', 0,
        'fire_response', '[TEST] structure fire', null, null, null, null, true)).id as ff_shift \gset
select tst.ok((select required_tier from public.shift_logs where id = :'ff_shift') = 'supervisor', 'SAFD firefighter: shift routed to SAFD supervisors');
select tst.fails($$select public.save_shift_log(null, 'safd', now() - interval '30 hours', now() - interval '29 hours', 0,
                  'ems_flight', 'x', null, null, null, null, true)$$, '23514', 'SAFD firefighter: unknown activity refused');
reset role;
select tst.ok(exists (select 1 from public.notifications where profile_id = tst.id('safd_lt') and related_id = :'ff_shift'),
              'SAFD lieutenant is notified of the firefighter''s shift');
select tst.ok(not exists (select 1 from public.notifications where profile_id = tst.id('dps_user') and related_id = :'ff_shift'),
              'DPS is not notified of SAFD shifts');

-- ------------------------------------------------ DPS commands every division
select tst.become('dps_user');
set role authenticated;
select tst.ok(exists (select 1 from public.shift_logs where id = :'ff_shift'), 'DPS: sees SAFD shift logs');
select tst.ok(public.can_decide('safd', 'supervisor') and public.can_manage_roster('saems'), 'DPS: can decide and manage Fire/EMS');
select tst.ok(public.can_view_personnel('safd') and public.can_view_personnel('bcso'), 'DPS: reads personnel in every division when granted');
reset role;

-- ------------------------------------------------ other members cannot see it

select tst.become('bcso_sup');
set role authenticated;
select tst.ok(not exists (select 1 from public.shift_logs where id = :'ff_shift'), 'BCSO supervisor: cannot see SAFD shift logs');
reset role;

select tst.become('saems_emt');
set role authenticated;
select tst.ok(not exists (select 1 from public.shift_logs where id = :'ff_shift'), 'SAEMS EMT: cannot see SAFD shift logs');
reset role;

-- ------------------------------------------------ Fire/EMS command
select tst.become('fems_cmd');
set role authenticated;
select tst.ok(exists (select 1 from public.shift_logs where id = :'ff_shift'), 'Fire/EMS command: sees SAFD shift logs');
select tst.ok(not exists (select 1 from public.shift_logs where department_key = 'bcso'), 'Fire/EMS command: cannot see BCSO shift logs');
select tst.ok(public.can_view_personnel('safd') and public.can_view_personnel('saems'), 'Fire/EMS command: reads Fire/EMS personnel when granted');
select tst.ok(not public.can_view_personnel('bcso'), 'Fire/EMS command: no BCSO personnel records');
select tst.fails(format('select public.update_membership(%L, null, %L, null, null, null, false, null, null, null, null, %L)',
                 :'bcso_mem_m', 'X-1', 'test'), 'D5403', 'Fire/EMS command: cannot change the BCSO roster');
select tst.ok((public.save_announcement(null, '[TEST] SAEMS briefing', 'x', 'department', 'saems', null, null, false, true)).status = 'published',
              'Fire/EMS command: posts SAEMS announcements');
select tst.ok((public.save_announcement(null, '[TEST] District notice', 'x', 'district', null, null, null, false, true)).status = 'published',
              'Fire/EMS command: posts district-wide announcements');
reset role;

-- ------------------------------------------------ the fire chief's own log goes to Fire/EMS command
select tst.become('safd_chief');
set role authenticated;
select (public.save_shift_log(null, 'safd', date_trunc('minute', now()) - interval '9 hours', date_trunc('minute', now()) - interval '7 hours', 0,
        'administrative', '[TEST] chief admin', null, null, null, null, true)).id as chief_shift \gset
select tst.ok((select required_tier from public.shift_logs where id = :'chief_shift') = 'dps', 'SAFD chief: shift routed to division command');
reset role;
select tst.ok(exists (select 1 from public.notifications where profile_id = tst.id('fems_cmd') and related_id = :'chief_shift'),
              'Fire/EMS command is notified of the chief''s shift');
select tst.ok(exists (select 1 from public.notifications where profile_id = tst.id('dps_user') and related_id = :'chief_shift'),
              'DPS is also notified of the chief''s shift');

select tst.become('safd_lt');
set role authenticated;
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'chief_shift', 'approve'), 'D5403', 'SAFD lieutenant: cannot decide the chief''s log');
select tst.ok((public.decide_shift_log(:'ff_shift', 'approve')).status = 'approved', 'SAFD lieutenant: approves the firefighter''s log');
reset role;

select tst.become('bcso_head');
set role authenticated;
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'chief_shift', 'approve'), 'D5403', 'BCSO sheriff: cannot decide the SAFD chief''s log');
reset role;

select tst.become('fems_cmd');
set role authenticated;
select tst.ok((public.decide_shift_log(:'chief_shift', 'approve')).status = 'approved', 'Fire/EMS command: approves the chief''s log');
reset role;

-- ------------------------------------------------ appointing a fire chief
select tst.become('safd_new');
set role authenticated;
select public.request_membership('safd', '[TEST] joining') as new_req \gset
reset role;

select tst.become('bcso_head');
set role authenticated;
select tst.fails(format('select public.decide_membership(%L, %L, %L)', :'new_req', 'approve', :'head_rank'), 'D5403',
                 'BCSO sheriff: cannot decide SAFD roster requests');
reset role;

select tst.become('safd_chief');
set role authenticated;
select tst.fails(format('select public.decide_membership(%L, %L, %L)', :'new_req', 'approve', :'head_rank'), 'D5403',
                 'SAFD chief: cannot appoint another department head');
reset role;

select tst.become('fems_cmd');
set role authenticated;
select tst.ok((public.decide_membership(:'new_req', 'approve', :'head_rank')).tier = 'department_head', 'Fire/EMS command: appoints a SAFD department head');
reset role;

select tst.become('safd_new');
set role authenticated;
select tst.fails($$select public.request_membership('fems')$$, 'D5403', 'members cannot request Fire/EMS command membership');
reset role;
