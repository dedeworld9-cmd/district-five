-- From the Fire/EMS Discord role list: SAFD "Firefighter I" sits between Probationary Firefighter
-- and Fire Captain, and the SAEMS probationary role is named "Probationary EMT".
insert into public.ranks (department_key, name, abbreviation, tier, sort_order) values
  ('safd', 'Firefighter I', null, 'patrol', 20)
on conflict (department_key, name) do nothing;
update public.ranks set name = 'Probationary EMT'
 where department_key = 'saems' and name = 'Probationary EMS'
   and not exists (select 1 from public.ranks where department_key = 'saems' and name = 'Probationary EMT');
