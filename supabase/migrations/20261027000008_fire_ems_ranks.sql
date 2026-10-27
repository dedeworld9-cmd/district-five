-- Fire/EMS rank ladders and subdivisions, transcribed from the TLN | Fire/EMS Hub Discord
-- (SAFD chain of command, SAEMS chain of command, subdivision channels). Ranks stay marked
-- is_sample until an administrator confirms them. SAFD's ranks between Probationary
-- Firefighter and Fire Captain are not listed on Discord, so none are invented here.

insert into public.ranks (department_key, name, abbreviation, tier, sort_order) values
  ('safd', 'Probationary Firefighter', null, 'probationary', 10),
  ('safd', 'Fire Captain', null, 'supervisor', 50),
  ('safd', 'Battalion Chief', null, 'high_command', 60),
  ('safd', 'Assistant Fire Chief', null, 'department_head', 70),
  ('safd', 'Deputy Fire Chief', null, 'department_head', 80),
  ('safd', 'Fire Chief', null, 'department_head', 90),
  ('saems', 'Probationary EMS', 'D-32', 'probationary', 10),
  ('saems', 'Basic EMS', 'D-23', 'patrol', 20),
  ('saems', 'Advanced EMS', 'D-15', 'patrol', 30),
  ('saems', 'Paramedic', 'D-08', 'patrol', 40),
  ('saems', 'Captain', 'D-05', 'supervisor', 50),
  ('saems', 'Division Chief', 'D-04', 'high_command', 60),
  ('saems', 'Assistant Medical Director', 'M-03', 'department_head', 70),
  ('saems', 'Deputy Medical Director', 'M-02', 'department_head', 80),
  ('saems', 'Medical Director', 'M-01', 'department_head', 90),
  ('fems', 'Assistant Fire & EMS Commissioner', 'FF-03', 'dps', 10),
  ('fems', 'Deputy Fire & EMS Commissioner', 'FF-02', 'dps', 20),
  ('fems', 'Fire & EMS Commissioner', 'FF-01', 'dps', 30)
on conflict (department_key, name) do nothing;

insert into public.department_options (department_key, kind, name, sort_order) values
  ('safd', 'subdivision', 'Marshal Operations', 10), ('safd', 'subdivision', 'Air Operations', 20),
  ('safd', 'subdivision', 'Wildlands Operations', 30), ('safd', 'subdivision', 'Hazmat Intervention Operations', 40),
  ('safd', 'subdivision', 'Tactical Rescue Operations', 50), ('safd', 'subdivision', 'Bomb Squad', 60),
  ('saems', 'subdivision', 'EMS Divers', 10), ('saems', 'subdivision', 'Tactical Rescue Operations', 20),
  ('saems', 'subdivision', 'Marshal Operations', 30), ('saems', 'subdivision', 'Wildlife Unit', 40),
  ('saems', 'subdivision', 'Air Operations', 50)
on conflict (department_key, kind, name) do nothing;
