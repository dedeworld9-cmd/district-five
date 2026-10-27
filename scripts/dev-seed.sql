-- Local development personas (matching app/dev-login). Fictional, labeled, never for production.
-- Fire/EMS ranks here are local placeholders; the real ladders are entered on the Admin page.
insert into public.ranks (department_key, name, tier, sort_order) values
  ('safd', '[DEV] Firefighter', 'patrol', 10), ('safd', '[DEV] Lieutenant', 'supervisor', 20),
  ('saems', '[DEV] EMT', 'patrol', 10), ('fems', '[DEV] Deputy Commissioner', 'dps', 10);

do $$
declare
  spec text[][] := array[
    ['bcso_member',      'Avery Cole',      'bcso', 'Deputy Sheriff Second Class', 'active',    '1D-24', '2024'],
    ['sahp_member',      'Jordan Reyes',    'sahp', 'Trooper',                     'active',    '4A-17', '4417'],
    ['dual_member',      'Sam Whitaker',    'bcso', 'Deputy Sheriff First Class',  'active',    '1D-09', '2009'],
    ['dual_member',      'Sam Whitaker',    'sahp', 'Senior Trooper',              'active',    '4A-31', '4431'],
    ['bcso_supervisor',  'Morgan Hale',     'bcso', 'Sergeant',                    'active',    '1S-03', '2103'],
    ['bcso_head',        'Riley Thornton',  'bcso', 'Sheriff',                     'active',    '1-ADAM', '1001'],
    ['dps_command',      'Casey Hathaway',  'dps',  'Deputy Commissioner',         'active',    'E-02',  null],
    ['suspended_member', 'Drew Kessler',    'bcso', 'Deputy Sheriff Second Class', 'suspended', '1D-40', '2040'],
    ['safd_member',      'Quinn Alvarez',   'safd', '[DEV] Firefighter',           'active',    'E-12',  '3012'],
    ['safd_supervisor',  'Parker Nash',     'safd', '[DEV] Lieutenant',            'active',    'L-3',   '3003'],
    ['saems_member',     'Rowan Ellis',     'saems', '[DEV] EMT',                  'active',    'M-21',  '5021'],
    ['fems_command',     'Lane Reeds',      'fems', '[DEV] Deputy Commissioner',   'active',    null,    null]];
  i int;
  u uuid;
  rk record;
begin
  for i in 1 .. array_length(spec, 1) loop
    select id into u from auth.users where email = spec[i][1] || '@dev.local';
    if u is null then
      insert into auth.users (email, raw_user_meta_data)
      values (spec[i][1] || '@dev.local', jsonb_build_object('full_name', spec[i][2], 'name', spec[i][1], 'provider_id', 'dev-' || spec[i][1]))
      returning id into u;
    end if;
    select * into rk from public.ranks where department_key = spec[i][3] and name = spec[i][4];
    insert into public.memberships (profile_id, display_name, department_key, rank_id, rank_name, tier, status, is_probationary, join_date, callsign, badge)
    values (u, spec[i][2], spec[i][3], rk.id, rk.name, rk.tier, spec[i][5]::public.membership_status, false, current_date - 60, spec[i][6], spec[i][7]);
  end loop;
  insert into auth.users (email, raw_user_meta_data) values
    ('admin@dev.local', '{"full_name":"Site Admin","name":"admin","provider_id":"dev-admin"}'),
    ('new_member@dev.local', '{"full_name":"Taylor Brooks","name":"new_member","provider_id":"dev-new_member"}');
  update public.profiles set is_admin = true where discord_id = 'dev-admin';
  update public.memberships set can_view_personnel = true where department_key in ('dps', 'fems');
end $$;

-- A few past shifts so the dashboard and queue have something in them.
do $$
declare
  mem uuid := (select id from public.profiles where discord_id = 'dev-bcso_member');
  sahp uuid := (select id from public.profiles where discord_id = 'dev-sahp_member');
  sup uuid := (select id from public.profiles where discord_id = 'dev-bcso_supervisor');
begin
  perform set_config('request.jwt.claim.sub', mem::text, true);
  perform public.save_shift_log(null, 'bcso', date_trunc('hour', now()) - interval '26 hours', date_trunc('hour', now()) - interval '24 hours', 0,
    'patrol', '[DEMO] Paleto Bay patrol, two traffic stops.', null, null, null, null, true);
  perform public.save_shift_log(null, 'bcso', date_trunc('hour', now()) - interval '5 hours', date_trunc('hour', now()) - interval '3 hours', 15,
    'patrol', '[DEMO] Sandy Shores, assisted SAHP with a pursuit.', 'CAD-2291', null, null, null, true);
  perform set_config('request.jwt.claim.sub', sahp::text, true);
  perform public.save_shift_log(null, 'sahp', date_trunc('hour', now()) - interval '8 hours', date_trunc('hour', now()) - interval '6 hours', 0,
    'traffic', '[DEMO] Route 68 speed enforcement.', null, null, null, null, true);
  perform set_config('request.jwt.claim.sub', sup::text, true);
  perform public.decide_shift_log((select id from public.shift_logs where profile_id = mem order by started_at limit 1), 'approve', null);
end $$;

insert into public.announcements (title, body, scope, status, published_at, author_name, is_demo, is_public, public_approved_at, pinned)
values ('[DEMO] District Five hub is live', 'Shift logs, approvals and the roster now live here. Clock in from your dashboard.', 'district',
        'published', now() - interval '2 hours', 'DPS', true, true, now(), true);
