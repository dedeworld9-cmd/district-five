-- Department panels: each department's heads run their own department's settings,
-- rank ladder, certifications and review routing. Site administrators and division
-- command keep that authority over every department they cover.

create or replace function public.can_administer(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select dept is not null and (public.is_admin() or public.oversees(dept) or public.has_tier(dept, 'department_head'))
$$;

create or replace function public.admin_update_department(
  p_key text, p_quota_minutes int, p_week_starts_on int, p_timezone text,
  p_bodycam_required boolean, p_bodycam_policy_text text, p_bodycam_policy_url text)
returns public.departments language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  before_d public.departments;
  d public.departments;
begin
  if not public.can_administer(p_key) then perform public.d5_raise('D5403', 'Department head authority is required.'); end if;
  select * into before_d from public.departments where key = p_key for update;
  if before_d.key is null then perform public.d5_raise('D5404', 'Department not found.'); end if;
  if p_timezone is not null and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    perform public.d5_raise('D5422', 'Unknown time zone.');
  end if;
  update public.departments set quota_minutes = coalesce(p_quota_minutes, quota_minutes), week_starts_on = coalesce(p_week_starts_on, week_starts_on),
    timezone = coalesce(p_timezone, timezone), bodycam_required = coalesce(p_bodycam_required, bodycam_required),
    bodycam_policy_text = p_bodycam_policy_text, bodycam_policy_url = p_bodycam_policy_url
  where key = p_key returning * into d;
  perform public.write_audit(p, 'department.updated', 'department', null, d.key, d.key, to_jsonb(before_d), to_jsonb(d));
  return d;
end;
$$;

create or replace function public.admin_save_rank(
  p_id uuid, p_department text, p_name text, p_abbreviation text, p_tier public.tier, p_sort int, p_active boolean)
returns public.ranks language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  r public.ranks;
  dept text := p_department;
begin
  if p_id is not null then
    select department_key into dept from public.ranks where id = p_id;
    if dept is null then perform public.d5_raise('D5404', 'Rank not found.'); end if;
  end if;
  if not public.can_administer(dept) then perform public.d5_raise('D5403', 'Department head authority is required.'); end if;
  -- Division command tiers are granted by division command, not by the department itself.
  if p_tier = 'dps' and not (public.is_admin() or public.oversees(dept)) then
    perform public.d5_raise('D5403', 'Only division command can create a division command rank.');
  end if;
  if p_id is null then
    insert into public.ranks (department_key, name, abbreviation, tier, sort_order, is_sample, active)
    values (dept, p_name, p_abbreviation, p_tier, coalesce(p_sort, 0), false, coalesce(p_active, true)) returning * into r;
  else
    if not (public.is_admin() or public.oversees(dept)) and exists (select 1 from public.ranks where id = p_id and tier = 'dps') then
      perform public.d5_raise('D5403', 'Only division command can change a division command rank.');
    end if;
    update public.ranks set name = p_name, abbreviation = p_abbreviation, tier = p_tier, sort_order = coalesce(p_sort, sort_order),
      active = coalesce(p_active, active), is_sample = false where id = p_id returning * into r;
  end if;
  perform public.write_audit(p, 'rank.saved', 'rank', r.id, r.name, r.department_key, null, to_jsonb(r));
  return r;
end;
$$;

create or replace function public.admin_save_route(
  p_record_type text, p_department text, p_submitter public.tier, p_required public.tier)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles := public.require_user();
begin
  if p_department is null then
    if not public.is_admin() then perform public.d5_raise('D5403', 'Only administrators can change the district default.'); end if;
  elsif not public.can_administer(p_department) then
    perform public.d5_raise('D5403', 'Department head authority is required.');
  end if;
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

create or replace function public.admin_save_option(
  p_id uuid, p_department text, p_kind text, p_name text, p_description text,
  p_min_tier public.tier, p_open boolean, p_sort int, p_active boolean default true)
returns public.department_options language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  o public.department_options;
  dept text := p_department;
begin
  if p_id is not null then
    select department_key into dept from public.department_options where id = p_id;
    if dept is null then perform public.d5_raise('D5404', 'Option not found.'); end if;
  end if;
  if not public.can_administer(dept) then perform public.d5_raise('D5403', 'Department head authority is required.'); end if;
  if p_id is null then
    insert into public.department_options (department_key, kind, name, description, min_tier, is_open, sort_order, active)
    values (dept, p_kind, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_min_tier, 'probationary'),
            coalesce(p_open, true), coalesce(p_sort, 0), coalesce(p_active, true))
    returning * into o;
  else
    update public.department_options set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), ''),
      min_tier = coalesce(p_min_tier, min_tier), is_open = coalesce(p_open, is_open), sort_order = coalesce(p_sort, sort_order),
      active = coalesce(p_active, active)
    where id = p_id returning * into o;
  end if;
  perform public.write_audit(p, 'option.saved', 'department_option', o.id, o.name, o.department_key);
  return o;
exception when unique_violation then
  perform public.d5_raise('D5409', 'That name is already listed for this department.');
end;
$$;

-- The BCSO ladder matches the chain-of-command post (10/21/26), so it is no longer a sample.
update public.ranks set is_sample = false where department_key = 'bcso';

revoke execute on function public.can_administer(text) from public, anon;
grant execute on function public.can_administer(text) to authenticated;
