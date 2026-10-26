-- Administration: settings, approval routing, and labeled demo data.

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  before_v jsonb;
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
  if p_key = 'dual_membership_mode' and p_value #>> '{}' not in ('combined', 'per_department') then
    perform public.d5_raise('D5422', 'Choose combined or per_department.');
  end if;
  select value into before_v from public.app_settings where key = p_key;
  insert into public.app_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.write_audit(p, 'setting.updated', 'setting', null, p_key, null, before_v, p_value);
end;
$$;

create or replace function public.admin_save_route(
  p_record_type text, p_department text, p_submitter public.tier, p_required public.tier)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles := public.require_user();
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
  if public.tier_rank(p_required) <= public.tier_rank(p_submitter) and p_required <> 'dps' then
    perform public.d5_raise('D5422', 'Reviewers must hold a higher tier than the submitter.');
  end if;
  insert into public.approval_routes (record_type, department_key, submitter_tier, required_tier)
  values (p_record_type, p_department, p_submitter, p_required)
  on conflict (record_type, department_key, submitter_tier) do update set required_tier = excluded.required_tier;
  perform public.write_audit(p, 'route.saved', 'approval_route', null, p_record_type, p_department, null,
    jsonb_build_object('submitter', p_submitter, 'required', p_required));
end;
$$;

-- Fictional sample content so a fresh hub is not empty. Every row is is_demo and
-- prefixed [DEMO]; admin_clear_demo removes all of it.
create or replace function public.admin_seed_demo()
returns int language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  n int := 0;
  rec record;
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
  if exists (select 1 from public.memberships where is_demo) then perform public.d5_raise('D5409', 'Demo data is already loaded.'); end if;
  for rec in
    select * from (values
      ('bcso', '[DEMO] R. Calloway', 'Sergeant', '1S-12', 'on_duty'),
      ('bcso', '[DEMO] T. Marsh', 'Deputy Sheriff First Class', '1D-31', 'off_duty'),
      ('bcso', '[DEMO] L. Ortega', 'Deputy Sheriff Third Class', '1D-48', 'off_duty'),
      ('sahp', '[DEMO] K. Whitfield', 'Lieutenant', '3A-04', 'off_duty'),
      ('sahp', '[DEMO] D. Reyes', 'Senior Trooper', '4A-22', 'on_duty'),
      ('sahp', '[DEMO] J. Park', 'Probationary Trooper', '5A-61', 'off_duty')
    ) v(dept, name, rank, callsign, duty)
  loop
    insert into public.memberships (display_name, department_key, rank_id, rank_name, tier, callsign, status, is_probationary,
                                    join_date, duty_status, is_demo)
    select rec.name, rec.dept, r.id, r.name, r.tier, rec.callsign, 'active', r.tier = 'probationary', current_date - 40,
           rec.duty::public.duty_status, true
    from public.ranks r where r.department_key = rec.dept and r.name = rec.rank;
    n := n + 1;
  end loop;
  insert into public.announcements (title, body, scope, status, published_at, author_name, is_demo, priority, pinned)
  values ('[DEMO] Welcome to the District Five hub',
          'This is sample content. Log shifts from the Shifts page, and supervisors review them under Approvals. An administrator can remove all demo content from Admin.',
          'district', 'published', now(), 'District Five', true, 'normal', true);
  perform public.write_audit(p, 'demo.seeded', 'demo', null, null, null, null, jsonb_build_object('members', n));
  return n;
end;
$$;

create or replace function public.admin_clear_demo()
returns int language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  n int;
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
  delete from public.personnel_records where membership_id in (select id from public.memberships where is_demo);
  update public.memberships set supervisor_id = null where supervisor_id in (select id from public.memberships where is_demo);
  update public.memberships set training_officer_id = null where training_officer_id in (select id from public.memberships where is_demo);
  delete from public.memberships where is_demo;
  get diagnostics n = row_count;
  delete from public.announcements where is_demo;
  delete from public.policies where is_demo and not exists (select 1 from public.policy_acknowledgments a where a.policy_id = policies.id);
  perform public.write_audit(p, 'demo.cleared', 'demo', null, null, null, null, jsonb_build_object('members', n));
  return n;
end;
$$;

revoke execute on function public.admin_set_setting(text, jsonb), public.admin_save_route(text, text, public.tier, public.tier),
  public.admin_seed_demo(), public.admin_clear_demo() from public, anon;
grant execute on function public.admin_set_setting(text, jsonb), public.admin_save_route(text, text, public.tier, public.tier),
  public.admin_seed_demo(), public.admin_clear_demo() to authenticated;
