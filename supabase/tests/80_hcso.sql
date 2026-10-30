-- HCSO, the department this site serves: seeded from the department's own Discord and SOP.

select tst.ok((select count(*) from public.ranks where department_key = 'hcso' and not is_sample) = 12, 'hcso: twelve confirmed ranks');
select tst.ok((select tier from public.ranks where department_key = 'hcso' and name = 'Sheriff') = 'department_head', 'hcso: sheriff heads the department');
select tst.ok((select count(*) from public.department_options where department_key = 'hcso' and kind = 'subdivision') = 2, 'hcso: patrol and TEU');
select tst.ok((select count(*) from public.policies where department_key = 'hcso' and status = 'approved') = 7, 'hcso: seven SOP policies');

select tst.become(null);
set role anon;
select tst.ok((select count(*) from public.departments where key = 'hcso') = 1, 'public: hcso is listed');
select tst.ok((select count(*) from public.department_options where department_key = 'hcso') = 2, 'public: hcso divisions are listed');
select tst.ok((select count(*) from public.policies where department_key = 'hcso') = 0, 'public: SOP summaries stay members-only');
reset role;

-- Office of the Sheriff: Sheriff, Undersheriff, Chief Deputy and Majors share the department_head tier.
select tst.ok((select count(*) from public.ranks where department_key = 'hcso' and tier = 'department_head') = 4, 'hcso: office of the sheriff holds four ranks');
select tst.ok((select tier from public.ranks where department_key = 'hcso' and name = 'Captain') = 'high_command', 'hcso: captain stays command');
select tst.ok(public.required_tier_for('shift_log', 'hcso', 'department_head') = 'department_head', 'hcso: sheriff-level logs are reviewed by another head');

-- Discord rank hint: stored per person, only for real HCSO ranks.
select tst.become('bcso_sup');
select public.report_discord_rank('Sergeant');
select tst.ok((select discord_rank from public.profiles where id = auth.uid()) = 'Sergeant', 'discord: rank hint stored');
select tst.fails('select public.report_discord_rank(''Emperor'')', 'D5400', 'discord: unknown rank rejected');

-- The site admin seats the Sheriff; the Sheriff then appoints the Office of the Sheriff.
do $$
declare
  u uuid; n uuid;
begin
  insert into auth.users (email, raw_user_meta_data) values ('hcso_sheriff@example.test', jsonb_build_object('full_name', '[TEST] hcso_sheriff', 'provider_id', 'disc-hs')) returning id into u;
  insert into tst.people values ('hcso_sheriff', u);
  insert into auth.users (email, raw_user_meta_data) values ('hcso_new@example.test', jsonb_build_object('full_name', '[TEST] hcso_new', 'provider_id', 'disc-hn')) returning id into n;
  insert into tst.people values ('hcso_new', n);
  insert into public.memberships (profile_id, display_name, department_key, rank_id, rank_name, tier, status)
  select u, '[TEST] hcso_sheriff', 'hcso', r.id, r.name, r.tier, 'active' from public.ranks r where r.department_key = 'hcso' and r.name = 'Sheriff';
end $$;

select tst.become('hcso_new');
set role authenticated;
select public.request_membership('hcso', '[TEST] joining') as hreq \gset
reset role;

select tst.become('hcso_sheriff');
set role authenticated;
select tst.ok((public.decide_membership(:'hreq', 'approve', (select id from public.ranks where department_key = 'hcso' and name = 'Major'))).rank_name = 'Major', 'hcso sheriff: appoints a major');
select tst.ok((public.update_membership((select id from public.memberships where profile_id = tst.id('hcso_new') and department_key = 'hcso'), (select id from public.ranks where department_key = 'hcso' and name = 'Undersheriff'), null, null, null, null, false, null, null, null, null, '[TEST] promote')).rank_name = 'Undersheriff', 'hcso sheriff: promotes to undersheriff');
select tst.fails(format('select public.update_membership(%L, %L, null, null, null, null, false, null, null, null, null, %L)',
  (select id from public.memberships where profile_id = tst.id('hcso_new') and department_key = 'hcso'),
  (select id from public.ranks where department_key = 'hcso' and name = 'Sheriff'), '[TEST] up'), 'D5403', 'hcso sheriff: cannot appoint another sheriff');
reset role;

-- An undersheriff cannot appoint above themselves, and other departments are unchanged.
select tst.become('hcso_new');
set role authenticated;
select tst.fails(format('select public.update_membership(%L, %L, null, null, null, null, false, null, null, null, null, %L)',
  (select id from public.memberships where profile_id = tst.id('hcso_sheriff') and department_key = 'hcso'),
  (select id from public.ranks where department_key = 'hcso' and name = 'Captain'), '[TEST] demote'), 'D5403', 'hcso undersheriff: cannot change the sheriff');
reset role;
