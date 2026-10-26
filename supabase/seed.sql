-- Configuration seed. Safe to re-run.
-- Rank ladders below were transcribed from the departments' Discord channels and are marked
-- is_sample = true until an administrator confirms them on the Admin page.

insert into public.departments (key, name, short_name, kind, tagline, accent, sort_order, bodycam_required) values
  ('bcso', 'Blaine County Sheriff''s Office', 'BCSO', 'department', 'Serving Blaine County', '#c9a227', 1, false),
  ('sahp', 'San Andreas Highway Patrol', 'SAHP', 'department', 'State highways and interstates', '#8fa8c8', 2, false),
  ('dps', 'Department of Public Safety', 'DPS', 'oversight', 'District Five oversight', '#d8dde6', 0, false)
on conflict (key) do nothing;

insert into public.ranks (department_key, name, abbreviation, tier, sort_order) values
  ('bcso', 'Deputy Sheriff Third Class', 'DS3', 'probationary', 10),
  ('bcso', 'Deputy Sheriff Second Class', 'DS2', 'patrol', 20),
  ('bcso', 'Deputy Sheriff First Class', 'DS1', 'patrol', 30),
  ('bcso', 'Corporal', 'Cpl', 'patrol', 40),
  ('bcso', 'Sergeant', 'Sgt', 'supervisor', 50),
  ('bcso', 'Staff Sergeant', 'SSgt', 'supervisor', 60),
  ('bcso', 'Sergeant Major', 'SgtMaj', 'supervisor', 70),
  ('bcso', 'Lieutenant', 'Lt', 'supervisor', 80),
  ('bcso', 'Captain', 'Capt', 'high_command', 90),
  ('bcso', 'Major', 'Maj', 'high_command', 100),
  ('bcso', 'Lieutenant Colonel', 'LtCol', 'high_command', 110),
  ('bcso', 'Colonel', 'Col', 'high_command', 120),
  ('bcso', 'Chief Deputy', 'CD', 'department_head', 130),
  ('bcso', 'Assistant Sheriff', 'AS', 'department_head', 140),
  ('bcso', 'Undersheriff', 'US', 'department_head', 150),
  ('bcso', 'Sheriff', 'Sheriff', 'department_head', 160),
  ('sahp', 'Probationary Trooper', '5A', 'probationary', 10),
  ('sahp', 'Trooper', '4A', 'patrol', 20),
  ('sahp', 'Senior Trooper', '4A', 'patrol', 30),
  ('sahp', 'Master Trooper', '4A', 'patrol', 40),
  ('sahp', 'Sergeant', '3A', 'supervisor', 50),
  ('sahp', 'Staff Sergeant', '3A', 'supervisor', 60),
  ('sahp', 'Lieutenant', '3A', 'supervisor', 70),
  ('sahp', 'Captain', '2A', 'high_command', 80),
  ('sahp', 'Commander', '2A', 'high_command', 90),
  ('sahp', 'Assistant Chief', '1A', 'department_head', 100),
  ('sahp', 'Chief', '1A', 'department_head', 110),
  ('sahp', 'Assistant Commissioner S.O.', '1A', 'department_head', 120),
  ('sahp', 'Assistant Commissioner F.O.', '1A', 'department_head', 130),
  ('sahp', 'Deputy Commissioner', '1A', 'department_head', 140),
  ('sahp', 'Commissioner', '1A', 'department_head', 150),
  ('dps', 'DPS Officer', null, 'dps', 10),
  ('dps', 'DPS Captain', null, 'dps', 20),
  ('dps', 'Assistant Commissioner', null, 'dps', 30),
  ('dps', 'Deputy Commissioner', 'E-02', 'dps', 40),
  ('dps', 'Commissioner', 'E-01', 'dps', 50)
on conflict (department_key, name) do nothing;

-- District-wide review routing (department rows override these).
insert into public.approval_routes (record_type, department_key, submitter_tier, required_tier) values
  ('shift_log', null, 'probationary', 'supervisor'),
  ('shift_log', null, 'patrol', 'supervisor'),
  ('shift_log', null, 'supervisor', 'high_command'),
  ('shift_log', null, 'high_command', 'department_head'),
  ('shift_log', null, 'department_head', 'dps'),
  ('shift_log', null, 'dps', 'dps')
on conflict do nothing;

insert into public.app_settings (key, value) values
  ('dual_membership_mode', '"combined"'),
  ('site_disclaimer', '"District Five is a PlayStation 5 roleplay community. All departments, people, and records on this site are fictional and are not affiliated with any real government agency."'),
  ('wso_label', '"WSO"')
on conflict (key) do nothing;
