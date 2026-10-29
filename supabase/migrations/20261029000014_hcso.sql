-- Hillsborough County Sheriff's Office (HCSO) on Florida State Roleplay: the department this
-- site now serves. Insert-only and re-runnable; existing departments and records are untouched.
--
-- Sources, read 2026-10-29:
--   ranks        HCSO Discord #command-info "Chain of Command" (posted 10/28/26)
--   divisions    HCSO Discord: Patrol category and Patrol Captain, TEU Commander in #promotions
--   policies     "HCSO Master SOP" Google Doc and the seven policy documents it links
-- Tier mapping is ours: the Discord groups are Administration, Command, Field Supervisor,
-- Field Staff and Deputy in Training.

insert into public.departments (key, name, short_name, kind, division, oversees, tagline, public_blurb, accent, sort_order, timezone)
values ('hcso', 'Hillsborough County Sheriff''s Office', 'HCSO', 'department', 'leo', '{}',
  'Serve and protect Hillsborough County',
  'We are here to serve and protect the community of Hillsborough County.',
  '#c9a227', 0, 'America/New_York')
on conflict (key) do nothing;

insert into public.ranks (department_key, name, abbreviation, tier, sort_order, is_sample) values
  ('hcso', 'Deputy in Training', null, 'probationary', 10, false),
  ('hcso', 'Probationary Deputy', null, 'probationary', 20, false),
  ('hcso', 'Deputy First Class', null, 'patrol', 30, false),
  ('hcso', 'Deputy Second Class', null, 'patrol', 40, false),
  ('hcso', 'Master Deputy', null, 'patrol', 50, false),
  ('hcso', 'Sergeant', null, 'supervisor', 60, false),
  ('hcso', 'Lieutenant', null, 'supervisor', 70, false),
  ('hcso', 'Captain', null, 'high_command', 80, false),
  ('hcso', 'Major', null, 'high_command', 90, false),
  ('hcso', 'Chief Deputy', null, 'high_command', 100, false),
  ('hcso', 'Undersheriff', null, 'department_head', 110, false),
  ('hcso', 'Sheriff', null, 'department_head', 120, false)
on conflict (department_key, name) do nothing;

insert into public.department_options (department_key, kind, name, description, sort_order) values
  ('hcso', 'subdivision', 'Patrol', 'The patrol division, led by the Patrol Captain.', 10),
  ('hcso', 'subdivision', 'Traffic Enforcement Unit', 'Traffic enforcement, led by the TEU Commander.', 20)
on conflict (department_key, kind, name) do nothing;

-- Standard operating procedures. The full text stays in the department's Google Docs;
-- members see the summary, open the source and acknowledge each one in Resources.
insert into public.policies (title, category, department_key, version, summary, source_url, status, requires_acknowledgment, effective_date)
select v.title, 'sop', 'hcso', '1.0', v.summary, v.url, 'approved', true, date '2026-10-25'
from (values
  ('Use of Force', 'Five levels of force, from Compliant to Serious Bodily Harm or Death. Force must be objectively reasonable, proportionate and documented.',
    'https://docs.google.com/document/d/1By_s5fNooH5DnSpaplg0mGmdQf2I47kV1JTt3SprQU0/edit'),
  ('Traffic Stops', 'Patrol car offset left and angled out, advisory lighting on multi-lane roads, and enforcement of yield and move-over laws.',
    'https://docs.google.com/document/d/1JAQdSOQvHiixix6xzvbX6-DR_mjy0R3UnzimLSBK1T4/edit'),
  ('Vehicular Pursuits', 'A pursuit needs at least one of fifteen listed conditions. A supervisor may end it when six of eleven termination conditions apply.',
    'https://docs.google.com/document/d/15fynM1XrT5rBL3CN0S_nLgrk7v9JEHIl-zm2LTjDAKI/edit'),
  ('Spike Strips', 'Deploy only when three of six conditions are met. Supervisors end authorization in metro areas, bad weather or with bystanders present.',
    'https://docs.google.com/document/d/1E5pWKYKY0kGH0ID5dW3O8dLHwLPzQvWVKeiXp4-uiWE/edit'),
  ('Grappler', 'Deploy only when two of three conditions are met, and never where a bystander could be harmed.',
    'https://docs.google.com/document/d/17n4DLEYlKRc-fO_fMv3fPSdPgGVGnrwLthythUq9ZI0/edit'),
  ('Air-1 Support', 'Request Air-1 when at least one of eight listed conditions applies.',
    'https://docs.google.com/document/d/1ETIt8B6LXeOY2_ElhPAjaLbsSXW3ahT_CiZ7dqgdksE/edit'),
  ('Vehicle Boxing', 'Boxing a suspect vehicle needs at least two of nine listed conditions and is treated as a use of force.',
    'https://docs.google.com/document/d/1xr0Cky8gUySwn96gA3lW7pPc1TQ_mWO1QoY5p8CqS20/edit')
) as v(title, summary, url)
where not exists (select 1 from public.policies p where p.department_key = 'hcso' and p.title = v.title);
