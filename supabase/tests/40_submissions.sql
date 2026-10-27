-- Reports and requests: required fields, routing, approval side effects, and who can read them.
-- Runs after 10_personas.sql and 30_divisions.sql on the same database.

-- A probationary BCSO deputy for FTO logs.
do $$
declare rk record; u uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values ('bcso_probie@example.test', '{"full_name":"[TEST] probie","provider_id":"disc-bcso_probie"}') returning id into u;
  insert into tst.people values ('bcso_probie', u);
  select * into rk from public.ranks where department_key = 'bcso' and tier = 'probationary' order by sort_order limit 1;
  insert into public.memberships (profile_id, display_name, department_key, rank_id, rank_name, tier, status, is_probationary, join_date)
  values (u, '[TEST] probie', 'bcso', rk.id, rk.name, rk.tier, 'active', true, current_date - 3);
  update public.department_options set is_open = false where department_key = 'sahp' and name = 'CID';
  -- 10_personas.sql ends with this deputy suspended; reinstate for these checks
  update public.memberships set status = 'active' where profile_id = tst.id('bcso_mem') and department_key = 'bcso';
end $$;
select id as probie_m from public.memberships where profile_id = tst.id('bcso_probie') \gset

-- ------------------------------------------------ incident report
select tst.become('sahp_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'incident', 'sahp', '{"location":"Route 68"}', null, current_date, null, null, true)$$,
                 'D5422', 'incident: summary and type are required');
select tst.fails($$select public.save_submission(null, 'incident', 'sahp', '{"location":"Route 68","incident_type":"Heist","summary":"x"}', null, current_date, null, null, true)$$,
                 'D5422', 'incident: type must come from the list');
select (public.save_submission(null, 'incident', 'sahp',
        '{"location":"Route 68","incident_type":"Traffic Stop","summary":"[TEST] speeding, citation issued"}', null, current_date, null, null, true)).id as inc \gset
select tst.ok((select required_tier from public.submissions where id = :'inc') = 'supervisor', 'incident: routed to supervisors');
select tst.ok((select title from public.submissions where id = :'inc') = 'Traffic Stop · Route 68', 'incident: readable title');
select tst.fails(format('select public.decide_submission(%L, %L)', :'inc', 'approve'), 'D5403', 'incident: cannot approve own report');
select (public.save_submission(null, 'incident', 'sahp', '{"location":"draft only"}', null, null, null, null, false)).status = 'draft' as ok \gset
select tst.ok(:'ok', 'incident: incomplete drafts can be saved');
reset role;

select tst.become('bcso_mem');
set role authenticated;
select tst.ok(not exists (select 1 from public.submissions where id = :'inc'), 'incident: another member cannot read it');
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.ok(not exists (select 1 from public.submissions where id = :'inc'), 'incident: another department''s supervisor cannot read it');
reset role;

select tst.become('sahp_sup');
set role authenticated;
select tst.ok((public.decide_submission(:'inc', 'approve')).status = 'approved', 'incident: SAHP supervisor approves');
reset role;

-- ------------------------------------------------ use of force
select tst.become('sahp_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'use_of_force', 'sahp', '{"force_type":"Physical","scene":"x"}', null, current_date, null, null, true)$$,
                 'D5422', 'use of force: video evidence required');
select tst.fails($$select public.save_submission(null, 'use_of_force', 'sahp', '{"force_type":"Physical","scene":"x"}', 'javascript:alert(1)', current_date, null, null, true)$$,
                 'D5422', 'use of force: evidence must be a web link');
select (public.save_submission(null, 'use_of_force', 'sahp', '{"force_type":"Less lethal","scene":"[TEST] taser on fleeing suspect"}',
        'https://example.test/clip', current_date, null, null, true)).id as uof \gset
select tst.ok((select required_tier from public.submissions where id = :'uof') = 'department_head', 'use of force: routed to department heads');
reset role;
select tst.become('sahp_sup');
set role authenticated;
select tst.fails(format('select public.decide_submission(%L, %L)', :'uof', 'approve'), 'D5403', 'use of force: supervisor cannot decide');
reset role;
select tst.become('dps_user');
set role authenticated;
select tst.ok((public.decide_submission(:'uof', 'approve', 'Reviewed footage, no further action.')).status = 'approved', 'use of force: DPS decides');
reset role;

-- ------------------------------------------------ warrants and BOLOs
select tst.become('bcso_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'warrant', 'bcso', '{"subject_name":"[TEST] J. Smith","charges":"Grand theft","probable_cause":"Witness ID"}', null, null, now() - interval '1 day', null, true)$$,
                 'D5422', 'warrant: expiration must be in the future');
select (public.save_submission(null, 'warrant', 'bcso', '{"subject_name":"[TEST] J. Smith","charges":"Grand theft auto","probable_cause":"Dashcam and witness ID"}',
        null, null, now() + interval '7 days', null, true)).id as war \gset
reset role;
select tst.become('dual');
set role authenticated;
select tst.ok(not exists (select 1 from public.submissions where id = :'war'), 'warrant: hidden from members until approved');
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.ok((public.decide_submission(:'war', 'approve')).status = 'approved', 'warrant: supervisor approves');
reset role;
select tst.become('sahp_mem');
set role authenticated;
select tst.ok(exists (select 1 from public.submissions where id = :'war'), 'warrant: active warrant visible to SAHP members too');
select tst.fails(format('select public.decide_submission(%L, %L)', :'war', 'archive'), 'D5403', 'warrant: a member cannot clear it');
reset role;
select tst.become('safd_ff');
set role authenticated;
select tst.ok(not exists (select 1 from public.submissions where id = :'war'), 'warrant: not visible to Fire/EMS');
select tst.fails($$select public.save_submission(null, 'warrant', 'safd', '{"subject_name":"x","charges":"x","probable_cause":"x"}', null, null, now() + interval '1 day', null, true)$$,
                 'D5422', 'warrant: Fire/EMS departments do not file warrants');
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.ok((public.decide_submission(:'war', 'archive', 'Served')).status = 'archived', 'warrant: supervisor clears it');
reset role;
select tst.become('sahp_mem');
set role authenticated;
select tst.ok(not exists (select 1 from public.submissions where id = :'war'), 'warrant: cleared warrant leaves the active list');
reset role;

-- ------------------------------------------------ certifications
select tst.become('sahp_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'certification', 'sahp', '{"requested":"Jetpack","why":"x","meets_requirements":"Yes"}', null, null, null, null, true)$$,
                 'D5422', 'certification: must be one the department offers');
select (public.save_submission(null, 'certification', 'sahp', '{"requested":"EVOC","why":"[TEST] want to drive","meets_requirements":"Yes"}',
        null, null, null, null, true)).id as cert \gset
reset role;
select tst.become('sahp_sup');
set role authenticated;
select tst.ok((public.decide_submission(:'cert', 'approve')).status = 'approved', 'certification: supervisor approves');
reset role;
select tst.ok(exists (select 1 from public.member_certifications c join public.memberships m on m.id = c.membership_id
                      where m.profile_id = tst.id('sahp_mem') and c.name = 'EVOC' and c.revoked_at is null), 'certification: added to the training record');
select tst.become('sahp_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'certification', 'sahp', '{"requested":"EVOC","why":"again","meets_requirements":"Yes"}', null, null, null, null, true)$$,
                 'D5409', 'certification: cannot request one already held');
reset role;

-- ------------------------------------------------ subdivisions
select tst.become('sahp_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'subdivision', 'sahp', '{"requested":"CID","why":"x"}', null, null, null, null, true)$$,
                 'D5409', 'subdivision: closed subdivisions refuse requests');
select (public.save_submission(null, 'subdivision', 'sahp', '{"requested":"SWAT","why":"[TEST] tactical interest"}', null, null, null, null, true)).id as sub \gset
select tst.ok((select required_tier from public.submissions where id = :'sub') = 'high_command', 'subdivision: routed to high command');
reset role;
select tst.become('sahp_sup');
set role authenticated;
select tst.fails(format('select public.decide_submission(%L, %L)', :'sub', 'approve'), 'D5403', 'subdivision: supervisor cannot decide');
reset role;
select tst.become('dps_user');
set role authenticated;
select tst.ok((public.decide_submission(:'sub', 'approve')).status = 'approved', 'subdivision: command approves');
reset role;
select tst.ok((select 'SWAT' = any(subdivisions) from public.memberships where profile_id = tst.id('sahp_mem') and department_key = 'sahp'),
              'subdivision: added to the membership');

-- ------------------------------------------------ leave
select tst.become('bcso_mem');
set role authenticated;
select tst.fails(format('select public.save_submission(null, %L, %L, %L::jsonb, null, null, null, null, true)', 'leave', 'bcso',
                 jsonb_build_object('start_date', current_date + 5, 'end_date', current_date + 2, 'reason', 'x')), 'D5422', 'leave: end before start refused');
select (public.save_submission(null, 'leave', 'bcso', jsonb_build_object('start_date', current_date, 'end_date', current_date + 10, 'reason', '[TEST] travel'),
        null, null, null, null, true)).id as lv \gset
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.ok((public.decide_submission(:'lv', 'approve')).status = 'approved', 'leave: supervisor approves');
reset role;
select tst.ok((select leave_until from public.memberships where profile_id = tst.id('bcso_mem') and department_key = 'bcso') >= current_date + 10,
              'leave: approved leave pauses the quota until the end date');

-- ------------------------------------------------ FTO logs
select tst.become('bcso_mem');
set role authenticated;
select tst.fails(format('select public.save_submission(null, %L, %L, %L::jsonb, null, current_date, null, %L, true)', 'fto_log', 'bcso',
                 '{"notes":"x","recommendation":"Continue training"}', :'probie_m'), 'D5403', 'FTO log: needs an FTO certification or supervisor');
reset role;
select tst.become('bcso_sup');
set role authenticated;
select tst.fails(format('select public.save_submission(null, %L, %L, %L::jsonb, null, current_date, null, %L, true)', 'fto_log', 'bcso',
                 '{"notes":"x","recommendation":"Continue training"}', (select id from public.memberships where profile_id = tst.id('bcso_mem') and department_key = 'bcso')),
                 'D5422', 'FTO log: subject must be probationary');
select (public.save_submission(null, 'fto_log', 'bcso', '{"notes":"[TEST] good radio discipline","recommendation":"Continue training"}',
        null, current_date, null, :'probie_m', true)).id as fto \gset
select tst.ok((select title from public.submissions where id = :'fto') = 'FTO log · [TEST] probie', 'FTO log: names the trainee');
reset role;
select tst.become('bcso_hc');
set role authenticated;
select tst.ok((public.decide_submission(:'fto', 'approve')).status = 'approved', 'FTO log: high command approves a supervisor''s log');
reset role;
select tst.become('bcso_probie');
set role authenticated;
select tst.ok(exists (select 1 from public.submissions where id = :'fto'), 'FTO log: the trainee reads approved logs about them');
reset role;

-- ------------------------------------------------ leaderboard
select tst.become('bcso_mem');
set role authenticated;
select tst.ok((select count(*) from public.weekly_leaderboard('bcso')) >= 1, 'leaderboard: members see their department');
reset role;
select tst.become('safd_ff');
set role authenticated;
select tst.fails($$select * from public.weekly_leaderboard('bcso')$$, 'D5403', 'leaderboard: other divisions cannot read it');
reset role;

-- ------------------------------------------------ nobody writes tables directly
select tst.become('bcso_mem');
set role authenticated;
select tst.fails($$insert into public.member_certifications (membership_id, department_key, name) select id, 'bcso', 'FTO' from public.memberships limit 1$$,
                 '42501', 'certifications cannot be inserted directly');
select tst.fails($$update public.submissions set status = 'approved'$$, '42501', 'submissions cannot be updated directly');
reset role;
