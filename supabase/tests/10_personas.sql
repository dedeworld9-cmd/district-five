-- Acceptance tests for the eight personas. Runs against a throwaway database
-- (scripts/test-db.sh). Each block switches identity, then asserts what that
-- person can and cannot do. Any failed assertion stops the run.

create schema tst;
grant usage on schema tst to anon, authenticated;
create table tst.people (handle text primary key, id uuid not null);
grant select on tst.people to anon, authenticated;

create function tst.id(h text) returns uuid language sql stable as $$ select id from tst.people where handle = h $$;
create function tst.become(h text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce((select id::text from tst.people where handle = h), ''), false)
$$;
create function tst.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
-- Runs a statement as the current role and asserts it fails with the given SQLSTATE.
create function tst.fails(stmt text, code text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = code then raise notice 'ok  % (% %)', label, sqlstate, sqlerrm; return; end if;
    raise exception 'FAIL: % expected % got %: %', label, code, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % expected error % but it succeeded', label, code;
end $$;
grant execute on all functions in schema tst to anon, authenticated;

-- ------------------------------------------------------------ fixtures
do $$
declare
  h text;
  u uuid;
  rk record;
  spec text[][] := array[
    -- handle,     dept,  rank,                          status
    ['bcso_mem',   'bcso', 'Deputy Sheriff Second Class', 'active'],
    ['sahp_mem',   'sahp', 'Trooper',                     'active'],
    ['dual',       'bcso', 'Deputy Sheriff First Class',  'active'],
    ['dual',       'sahp', 'Senior Trooper',              'active'],
    ['bcso_sup',   'bcso', 'Sergeant',                    'active'],
    ['bcso_sup2',  'bcso', 'Staff Sergeant',              'active'],
    ['sahp_sup',   'sahp', 'Sergeant',                    'active'],
    ['bcso_hc',    'bcso', 'Captain',                     'active'],
    ['bcso_head',  'bcso', 'Sheriff',                     'active'],
    ['dps_user',   'dps',  'Captain of DPS',              'active'],
    ['suspended',  'bcso', 'Deputy Sheriff Second Class', 'suspended']];
  i int;
begin
  foreach h in array array['bcso_mem','sahp_mem','dual','bcso_sup','bcso_sup2','sahp_sup','bcso_hc','bcso_head','dps_user','suspended','admin','outsider'] loop
    insert into auth.users (email, raw_user_meta_data)
    values (h || '@example.test', jsonb_build_object('full_name', '[TEST] ' || h, 'provider_id', 'disc-' || h))
    returning id into u;
    insert into tst.people values (h, u);
  end loop;
  for i in 1 .. array_length(spec, 1) loop
    select * into rk from public.ranks where department_key = spec[i][2] and name = spec[i][3];
    insert into public.memberships (profile_id, display_name, department_key, rank_id, rank_name, tier, status, is_probationary, join_date, callsign)
    values (tst.id(spec[i][1]), '[TEST] ' || spec[i][1], spec[i][2], rk.id, rk.name, rk.tier, spec[i][4]::public.membership_status,
            false, current_date - 30, upper(spec[i][2]) || '-' || i);
  end loop;
  update public.memberships set can_view_personnel = true where profile_id = tst.id('dps_user');
  update public.profiles set is_admin = true where id = tst.id('admin');
end $$;

select tst.ok((select count(*) from public.profiles where display_name like '[TEST]%') = 12, 'sign-up trigger created a profile per user');
select tst.ok(public.week_start_for('2026-10-26 03:00+00', 'America/New_York', 1) = '2026-10-19',
              'Sunday 11pm New York still belongs to the week starting Monday 19th');
select tst.ok(public.week_start_for('2026-10-26 05:00+00', 'America/New_York', 1) = '2026-10-26',
              'Monday 1am New York starts a new week');

-- ------------------------------------------------- public visitor (anon)
select tst.become(null);
set role anon;
select tst.ok((select count(*) from public.departments) = 6, 'public: departments are listed');
select tst.ok((select count(*) from public.memberships) = 0, 'public: roster is hidden');
select tst.ok((select count(*) from public.profiles) = 0, 'public: profiles are hidden');
select tst.ok((select count(*) from public.shift_logs) = 0, 'public: shift logs are hidden');
select tst.fails($$select public.request_membership('bcso')$$, '42501', 'public: cannot call workflow functions');
select tst.fails($$insert into public.announcements (title) values ('hello')$$, '42501', 'public: cannot write tables');
reset role;

-- ------------------------------------------------------- direct writes
select tst.become('bcso_mem');
set role authenticated;
select tst.fails($$insert into public.memberships (profile_id, display_name, department_key, tier, status)
                  values (auth.uid(), 'x', 'dps', 'dps', 'active')$$, '42501', 'member: cannot self-grant a DPS membership');
select tst.fails($$update public.memberships set tier = 'dps' where profile_id = auth.uid()$$, '42501', 'member: cannot edit own tier');
select tst.fails($$update public.profiles set is_admin = true where id = auth.uid()$$, '42501', 'member: cannot make self admin');
select tst.fails($$delete from public.audit_log$$, '42501', 'member: cannot delete audit log');
select tst.fails($$select public.notify(auth.uid(), 't', null, null, 'x')$$, '42501', 'member: internal helpers are not callable');

-- ------------------------------------------------------- BCSO member
select tst.fails($$select public.save_shift_log(null, 'sahp', now() - interval '3 hours', now() - interval '1 hour', 0,
                  'patrol', 'x', null, null, null, null, true)$$, 'D5403', 'BCSO member: cannot log SAHP time');
select tst.fails($$select public.save_shift_log(null, 'bcso', now() + interval '2 hours', now() + interval '3 hours', 0,
                  'patrol', 'x', null, null, null, null, true)$$, 'D5422', 'BCSO member: cannot log future time');
select tst.fails($$select public.save_shift_log(null, 'bcso', now() - interval '20 hours', now() - interval '1 hour', 0,
                  'patrol', 'x', null, null, null, null, true)$$, 'D5422', 'BCSO member: single entry capped at 16h');
select tst.fails($$select public.save_shift_log(null, 'bcso', now() - interval '3 hours', now() - interval '1 hour', 0,
                  'patrol', 'x', null, null, 'recorded', null, true)$$, 'D5422', 'BCSO member: recorded bodycam needs a link');
select (public.save_shift_log(null, 'bcso', date_trunc('minute', now()) - interval '3 hours', date_trunc('minute', now()) - interval '1 hour', 0,
        'patrol', '[TEST] patrol', null, null, null, null, true)).id as mem_shift \gset
select tst.ok((select status from public.shift_logs where id = :'mem_shift') = 'submitted', 'BCSO member: shift submitted');
select tst.ok((select required_tier from public.shift_logs where id = :'mem_shift') = 'supervisor', 'BCSO member: routed to supervisors');
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'mem_shift', 'approve'), 'D5403', 'BCSO member: cannot approve own shift');
select tst.fails($$select public.save_shift_log(null, 'bcso', now() - interval '150 minutes', now() - interval '30 minutes', 0,
                  'patrol', 'x', null, null, null, null, true)$$, 'D5409', 'BCSO member: overlapping entry refused');
select (public.save_shift_log(null, 'bcso', date_trunc('minute', now()) - interval '6 hours', date_trunc('minute', now()) - interval '5 hours', 0,
        'training', '[TEST] draft', null, null, null, null, false)).id as mem_draft \gset
select tst.fails(format('select public.save_shift_log(%L, %L, now() - interval %L, now() - interval %L, 0, %L, %L, null, null, null, null, false, 99)',
                 :'mem_draft', 'bcso', '6 hours', '5 hours', 'training', 'x'), 'D5409', 'BCSO member: stale version refused');
select tst.ok((select count(*) from public.memberships where department_key = 'sahp') > 0, 'BCSO member: can see the district roster');
select tst.ok((select count(*) from public.personnel_records) = 0, 'BCSO member: personnel records hidden');
reset role;
select tst.ok((select count(*) from public.notifications n where n.related_id = :'mem_shift') = 4,
              'submit notified the BCSO reviewers (2 sergeants, captain, sheriff)');
select tst.ok(not exists (select 1 from public.notifications where related_id = :'mem_shift' and profile_id in (tst.id('sahp_sup'), tst.id('bcso_mem'))),
              'no SAHP reviewer or submitter was notified');

-- ------------------------------------------------------- SAHP member and SAHP supervisor
select tst.become('sahp_mem');
set role authenticated;
select tst.ok((select count(*) from public.shift_logs) = 0, 'SAHP member: cannot see BCSO shift logs');
select tst.ok((select count(*) from public.profiles) = 1, 'SAHP member: sees only own profile');
reset role;
select tst.become('sahp_sup');
set role authenticated;
select tst.ok((select count(*) from public.shift_logs where id = :'mem_shift') = 0, 'SAHP supervisor: cannot see BCSO shift logs');
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'mem_shift', 'approve'), 'D5403', 'SAHP supervisor: cannot decide BCSO logs');
reset role;

-- ------------------------------------------------------- BCSO supervisor
select tst.become('bcso_sup');
set role authenticated;
select tst.ok((select count(*) from public.shift_logs where id = :'mem_shift') = 1, 'BCSO supervisor: sees the submitted log');
select tst.ok((select count(*) from public.shift_logs where id = :'mem_draft') = 0, 'BCSO supervisor: cannot see a member''s draft');
select tst.fails(format('select public.decide_shift_log(%L, %L, %L)', :'mem_shift', 'deny', 'no'), 'D5422', 'BCSO supervisor: denial needs a reason');
select tst.ok((public.decide_shift_log(:'mem_shift', 'approve')).status = 'approved', 'BCSO supervisor: approves the log');
select (public.save_shift_log(null, 'bcso', date_trunc('minute', now()) - interval '4 hours', date_trunc('minute', now()) - interval '3 hours', 0,
        'supervision', '[TEST] sup shift', null, null, null, null, true)).id as sup_shift \gset
select tst.ok((select required_tier from public.shift_logs where id = :'sup_shift') = 'high_command', 'BCSO supervisor: own log routes to high command');
select tst.fails(format('select public.department_compliance(%L)', 'sahp'), 'D5403', 'BCSO supervisor: no SAHP compliance view');
select tst.ok((select count(*) from public.department_compliance('bcso')) >= 5, 'BCSO supervisor: sees BCSO compliance');
select tst.ok((select count(*) from public.personnel_records) = 0, 'BCSO supervisor: personnel records hidden');
reset role;
select tst.become('bcso_sup2');
set role authenticated;
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'mem_shift', 'approve'), 'D5409', 'second reviewer: duplicate decision refused');
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'sup_shift', 'approve'), 'D5403', 'peer supervisor: cannot approve a supervisor''s log');
reset role;
select tst.ok((select count(*) from public.approval_actions where record_id = :'mem_shift') = 2, 'timeline has submitted + approved');

-- ------------------------------------------------------- dual-department member
select tst.become('dual');
set role authenticated;
select (public.save_shift_log(null, 'bcso', date_trunc('hour', now()) - interval '10 hours', date_trunc('hour', now()) - interval '8 hours', 0,
        'patrol', '[TEST] bcso', null, null, null, null, true)).id as dual_b \gset
select tst.fails($$select public.save_shift_log(null, 'sahp', date_trunc('hour', now()) - interval '9 hours', date_trunc('hour', now()) - interval '7 hours', 0,
                  'traffic', 'x', null, null, null, null, true)$$, 'D5409', 'dual: overlapping time across departments refused');
select (public.save_shift_log(null, 'sahp', date_trunc('hour', now()) - interval '8 hours', date_trunc('hour', now()) - interval '7 hours', 0,
        'traffic', '[TEST] sahp', null, null, null, null, true)).id as dual_s \gset
select tst.ok(true, 'dual: back-to-back shifts in two departments allowed');
select tst.ok((select count(*) from public.my_activity(1)) = 2, 'dual: activity reported per department');
select public.set_duty_status('bcso', 'on_duty');
select public.set_duty_status('sahp', 'on_duty');
select tst.ok((select count(*) from public.memberships where profile_id = auth.uid() and duty_status = 'on_duty') = 1,
              'dual: on duty in only one department at a time');
select tst.fails($$select public.set_active_department('dps')$$, 'D5403', 'dual: cannot switch into DPS');
select tst.fails($$select public.request_membership('dps')$$, 'D5403', 'dual: DPS membership cannot be requested');
reset role;
-- the overlap constraint holds even for writes that bypass the functions
select tst.fails(format($$insert into public.shift_logs (profile_id, membership_id, department_key, snapshot_name, snapshot_tier,
  started_at, ended_at, duration_minutes, week_start, activity_type, status)
  select profile_id, membership_id, 'sahp', 'x', 'patrol', started_at + interval '30 minutes', ended_at, 60, week_start, 'patrol', 'approved'
  from public.shift_logs where id = %L$$, :'dual_b'), '23P01', 'database constraint blocks double counted time');

-- ------------------------------------------------------- high command
select tst.become('bcso_hc');
set role authenticated;
select tst.ok((public.decide_shift_log(:'sup_shift', 'approve')).status = 'approved', 'BCSO captain: approves a sergeant''s log');
select tst.ok((select count(*) from public.personnel_records) = 0, 'BCSO captain: personnel records hidden without a grant');
select tst.fails($$select public.save_announcement(null, '[TEST] district', 'x', 'district', null, null, null, false, true)$$,
                 'D5403', 'BCSO captain: cannot publish district announcements');
select (public.save_announcement(null, '[TEST] BCSO briefing', 'x', 'department', 'bcso', null, null, false, true)).id as bcso_ann \gset
select tst.fails(format('select public.set_announcement_public(%L, true)', :'bcso_ann'), 'D5403', 'BCSO captain: cannot approve public content');
select tst.fails(format('select public.update_membership(%L, p_badge => %L, p_reason => %L)',
                 (select id from public.memberships where profile_id = auth.uid()), '1', 'self'), 'D5403', 'BCSO captain: cannot edit own membership');
reset role;

-- ------------------------------------------------------- roster requests
select tst.become('outsider');
set role authenticated;
select public.request_membership('bcso', '[TEST] please') as req \gset
select tst.fails($$select public.request_membership('bcso')$$, 'D5409', 'outsider: duplicate request refused');
select tst.fails($$select public.save_shift_log(null, 'bcso', now() - interval '3 hours', now() - interval '1 hour', 0,
                  'patrol', 'x', null, null, null, null, true)$$, 'D5403', 'pending member: cannot log time');
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.fails(format('select public.decide_membership(%L, %L, %L)', :'req', 'approve',
                 (select id from public.ranks where department_key = 'bcso' and name = 'Deputy Sheriff Third Class')),
                 'D5403', 'sergeant: cannot decide roster requests');
reset role;
select tst.become('bcso_hc');
set role authenticated;
select tst.fails(format('select public.decide_membership(%L, %L, %L)', :'req', 'approve',
                 (select id from public.ranks where department_key = 'bcso' and name = 'Sheriff')), 'D5403', 'captain: cannot appoint a sheriff');
select tst.fails(format('select public.decide_membership(%L, %L, %L)', :'req', 'approve',
                 (select id from public.ranks where department_key = 'bcso' and name = 'Major')), 'D5403', 'captain: cannot appoint at own tier');
select tst.fails(format('select public.decide_membership(%L, %L, %L)', :'req', 'approve',
                 (select id from public.ranks where department_key = 'sahp' and name = 'Trooper')), 'D5422', 'captain: rank must be from BCSO ladder');
select tst.ok((public.decide_membership(:'req', 'approve',
              (select id from public.ranks where department_key = 'bcso' and name = 'Deputy Sheriff Third Class'), 'B-99', '9999')).status = 'active',
              'captain: approves a probationary deputy');
select tst.fails(format('select public.decide_membership(%L, %L)', :'req', 'deny'), 'D5409', 'captain: request cannot be decided twice');
reset role;

-- ------------------------------------------------------- department head
select tst.become('bcso_head');
set role authenticated;
select tst.ok((select count(*) from public.personnel_records where department_key = 'bcso') >= 1, 'sheriff: sees BCSO personnel records');
select tst.ok((select count(*) from public.personnel_records where department_key = 'sahp') = 0, 'sheriff: no SAHP personnel records');
select tst.ok((public.set_announcement_public(:'bcso_ann', true)).is_public, 'sheriff: approves a BCSO post for the public site');
select (public.save_shift_log(null, 'bcso', date_trunc('minute', now()) - interval '12 hours', date_trunc('minute', now()) - interval '11 hours', 0,
        'administrative', '[TEST] head shift', null, null, null, null, true)).id as head_shift \gset
select tst.ok((select required_tier from public.shift_logs where id = :'head_shift') = 'dps', 'sheriff: own log routes to DPS');
select tst.fails($$select public.admin_update_department('bcso', 60, null, null, null, null, null)$$, 'D5403', 'sheriff: admin settings need admin');
reset role;
select tst.become('bcso_hc');
set role authenticated;
select tst.fails(format('select public.decide_shift_log(%L, %L)', :'head_shift', 'approve'), 'D5403', 'captain: cannot approve the sheriff''s log');
reset role;

-- ------------------------------------------------------- DPS
select tst.become('dps_user');
set role authenticated;
select tst.ok((select count(*) from public.shift_logs where department_key in ('bcso', 'sahp')) >= 5, 'DPS: sees both departments'' logs');
select tst.ok((public.decide_shift_log(:'head_shift', 'approve')).status = 'approved', 'DPS: approves a department head''s log');
select tst.ok((public.decide_shift_log(:'dual_s', 'return', 'Add the CAD reference')).status = 'returned', 'DPS: returns a SAHP log for correction');
select tst.ok((select count(*) from public.personnel_records) >= 1, 'DPS with personnel grant: sees personnel records');
select (public.save_announcement(null, '[TEST] District notice', 'x', 'district', null, 'important', null, true, true)).id as dps_ann \gset
select (public.save_announcement(null, '[TEST] District draft', 'x', 'district', null, null, null, false, false)).id as dps_draft \gset
select public.set_announcement_public(:'dps_ann', true);
select tst.fails(format('select public.set_announcement_public(%L, true)', :'dps_draft'), 'D5409', 'DPS: a draft cannot go public');
reset role;
select tst.become('bcso_hc');
set role authenticated;
select tst.fails(format('select public.save_announcement(%L, %L, %L, %L, %L, null, null, false, true)', :'dps_ann', 'hijack', 'x', 'department', 'bcso'),
                 'D5403', 'captain: cannot edit a district announcement by claiming department scope');
reset role;
select tst.become('dual');
set role authenticated;
select tst.ok((select count(*) from public.announcements) = 2, 'member: sees published district + BCSO posts, not drafts');
select tst.ok((select count(*) from public.notifications where related_id = :'dual_s' and title like '%returned%') = 1, 'dual: told the log was returned');
select tst.ok((public.save_shift_log(:'dual_s', 'sahp', date_trunc('hour', now()) - interval '8 hours', date_trunc('hour', now()) - interval '7 hours', 0,
        'traffic', '[TEST] sahp fixed', 'CAD-1', null, null, null, true)).status = 'submitted', 'dual: corrects and resubmits');
reset role;
select tst.ok((select action from public.approval_actions where record_id = :'dual_s' order by created_at desc limit 1) = 'resubmitted',
              'timeline records the resubmission');

select tst.become(null);
set role anon;
select tst.ok((select count(*) from public.announcements) = 2, 'public: sees exactly the two approved public posts');
select tst.ok(not exists (select 1 from public.announcements where id = :'dps_draft'), 'public: drafts never shown');
reset role;

-- ------------------------------------------------------- activity math and leave
select tst.become('bcso_mem');
set role authenticated;
select tst.ok((select approved_minutes from public.my_activity(1) where department_key = 'bcso') = 120, 'activity: 2h approved this week');
select tst.ok((select quota_minutes from public.my_activity(1) where department_key = 'bcso') = 240, 'activity: quota is 4h');
reset role;
select tst.become('bcso_hc');
set role authenticated;
select public.update_membership((select id from public.memberships where profile_id = tst.id('bcso_mem')),
                                p_leave_until => current_date + 14, p_reason => '[TEST] LOA');
reset role;
select tst.become('bcso_mem');
set role authenticated;
select tst.ok((select exempt from public.my_activity(1) where department_key = 'bcso'), 'activity: leave exempts the week');
select tst.ok((select count(*) from public.notifications where title like '%membership changed%') = 0, 'leave alone does not send a rank-change alert');
reset role;

-- ------------------------------------------------------- suspended member
select tst.become('suspended');
set role authenticated;
select tst.ok((select count(*) from public.memberships) = 1, 'suspended: sees only own membership');
select tst.ok(not exists (select 1 from public.announcements where not is_public), 'suspended: sees only what the public site shows');
select tst.fails($$select public.save_shift_log(null, 'bcso', now() - interval '3 hours', now() - interval '1 hour', 0,
                  'patrol', 'x', null, null, null, null, true)$$, 'D5403', 'suspended: cannot log time');
select tst.fails($$select public.set_duty_status('bcso', 'on_duty')$$, 'D5403', 'suspended: cannot go on duty');
reset role;
select tst.become('bcso_hc');
set role authenticated;
select public.update_membership((select id from public.memberships where profile_id = tst.id('bcso_mem')),
                                p_status => 'suspended', p_reason => '[TEST] suspension');
reset role;
select tst.become('bcso_mem');
set role authenticated;
select tst.ok((select count(*) from public.memberships) = 1, 'newly suspended: roster access revoked at once');
select tst.ok((select count(*) from public.shift_logs) = 2, 'newly suspended: still sees own history');
reset role;

-- ------------------------------------------------------- technical admin
select tst.become('admin');
set role authenticated;
select tst.ok((select count(*) from public.personnel_records) = 0, 'admin: technical admin does not grant personnel access');
select tst.ok((public.admin_update_department('bcso', 300, 0, 'America/Chicago', true, null, null)).quota_minutes = 300, 'admin: updates quota and week settings');
select tst.fails($$select public.admin_update_department('bcso', null, null, 'Mars/Olympus', null, null, null)$$, 'D5422', 'admin: rejects unknown time zones');
select public.admin_add_roster_member('sahp', '[TEST] Imported trooper', 'disc-newcomer',
       (select id from public.ranks where department_key = 'sahp' and name = 'Trooper'), 'S-77', '7777', null);
reset role;
insert into auth.users (email, raw_user_meta_data) values ('newcomer@example.test', '{"full_name":"[TEST] newcomer","provider_id":"disc-newcomer"}');
select tst.ok((select profile_id from public.memberships where display_name = '[TEST] Imported trooper') =
              (select id from public.profiles where discord_id = 'disc-newcomer'), 'roster import links on first Discord sign-in');
select tst.ok((select bodycam_required from public.departments where key = 'bcso'), 'bodycam requirement toggled by admin');

-- audit trail
select tst.ok((select count(*) from public.audit_log) > 15, 'audit log is being written');
select tst.fails($$update public.audit_log set action = 'x'$$, 'P0001', 'audit log is append-only even for the owner');

-- demo data
select tst.become('bcso_head');
set role authenticated;
select tst.fails($$select public.admin_seed_demo()$$, 'D5403', 'sheriff: cannot load demo data');
reset role;
select tst.become('admin');
set role authenticated;
select tst.ok(public.admin_seed_demo() = 6, 'admin: loads labeled demo roster');
select tst.fails($$select public.admin_seed_demo()$$, 'D5409', 'admin: demo data loads once');
select tst.fails($$select public.admin_set_setting('dual_membership_mode', '"sometimes"')$$, 'D5422', 'admin: dual mode validated');
select public.admin_set_setting('dual_membership_mode', '"per_department"');
select tst.fails($$select public.admin_save_route('shift_log', 'bcso', 'supervisor', 'patrol')$$, 'D5422', 'admin: route must escalate');
reset role;
select tst.ok((select count(*) from public.memberships where is_demo and display_name not like '[DEMO]%') = 0, 'every demo row is labeled');
select tst.become('admin');
set role authenticated;
select tst.ok(public.admin_clear_demo() = 6, 'admin: removes demo roster');
reset role;
select tst.ok(not exists (select 1 from public.announcements where is_demo), 'demo announcements removed');
