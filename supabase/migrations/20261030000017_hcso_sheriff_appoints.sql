-- Sheriff-led appointments for HCSO. HCSO has no oversight department, so until now only the site admin
-- could seat the top ranks. After the admin seats the Sheriff, anyone in the Office of the Sheriff may
-- appoint or promote to any HCSO rank strictly below their own. Other departments keep the old rule.

create or replace function public.can_grant_rank(p_department text, p_rank public.ranks)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  mine public.ranks;
begin
  if public.oversees(p_department) or public.is_admin() then return true; end if;
  if p_department = 'hcso' and public.has_tier(p_department, 'department_head') then
    select r.* into mine from public.memberships m join public.ranks r on r.id = m.rank_id
    where m.profile_id = auth.uid() and m.department_key = p_department and m.status = 'active';
    return mine.id is not null and mine.sort_order > p_rank.sort_order;
  end if;
  return public.tier_rank(p_rank.tier) < public.tier_rank(public.my_tier(p_department));
end;
$$;

create or replace function public.decide_membership(
  p_membership uuid, p_action text, p_rank uuid default null, p_callsign text default null,
  p_badge text default null, p_reason text default null)
returns public.memberships language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  m public.memberships;
  r public.ranks;
begin
  select * into m from public.memberships where id = p_membership for update;
  if m.id is null then perform public.d5_raise('D5404', 'Membership not found.'); end if;
  if not public.can_manage_roster(m.department_key) then perform public.d5_raise('D5403', 'High command authority is required to decide roster requests.'); end if;
  if m.profile_id = p.id then perform public.d5_raise('D5403', 'You cannot approve your own roster request.'); end if;
  if m.status <> 'pending' then perform public.d5_raise('D5409', 'This request was already decided.'); end if;

  if p_action = 'approve' then
    select * into r from public.ranks where id = p_rank and department_key = m.department_key and active;
    if r.id is null then perform public.d5_raise('D5422', 'Choose a rank from this department''s ladder.'); end if;
    if not public.can_grant_rank(m.department_key, r) then
      perform public.d5_raise('D5403', 'You can only appoint ranks below your own.');
    end if;
    update public.memberships set status = 'active', rank_id = r.id, rank_name = r.name, tier = r.tier,
      callsign = nullif(trim(p_callsign), ''), badge = nullif(trim(p_badge), ''),
      is_probationary = (r.tier = 'probationary'), join_date = coalesce(join_date, current_date)
    where id = m.id returning * into m;
    insert into public.personnel_records (membership_id, department_key, category, title, after_value, created_by, created_by_name)
    values (m.id, m.department_key, 'roster_change', 'Added to roster as ' || r.name,
            jsonb_build_object('rank', r.name, 'callsign', m.callsign, 'badge', m.badge), p.id, p.display_name);
  elsif p_action = 'deny' then
    if length(trim(coalesce(p_reason, ''))) < 5 then perform public.d5_raise('D5422', 'A denial needs a reason.'); end if;
    update public.memberships set status = 'denied' where id = m.id returning * into m;
  else
    perform public.d5_raise('D5422', 'Unknown action.');
  end if;

  insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, actor_tier, action, from_status, to_status, reason)
  values ('membership', m.id, m.ref, m.department_key, m.profile_id, p.id, p.display_name, public.my_tier(m.department_key),
          case when p_action = 'approve' then 'approved' else 'denied' end, 'pending', m.status::text, p_reason);
  if m.profile_id is not null then
    perform public.notify(m.profile_id,
      case when p_action = 'approve' then 'Welcome to ' || upper(m.department_key) else 'Roster request denied' end,
      coalesce(p_reason, case when p_action = 'approve' then 'You are on the roster as ' || m.rank_name || '.' end),
      '/hub/roster/' || m.id, 'roster', 'high', m.department_key, 'membership', m.id, null);
  end if;
  perform public.write_audit(p, 'membership.' || p_action, 'membership', m.id, m.ref, m.department_key, null, to_jsonb(m));
  return m;
end;
$$;
create or replace function public.update_membership(
  p_membership uuid, p_rank uuid default null, p_callsign text default null, p_badge text default null,
  p_status public.membership_status default null, p_leave_until date default null, p_clear_leave boolean default false,
  p_supervisor uuid default null, p_training_officer uuid default null, p_subdivisions text[] default null,
  p_can_view_personnel boolean default null, p_reason text default null)
returns public.memberships language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  m public.memberships;
  before_m public.memberships;
  r public.ranks;
  personnel_change boolean := false;
begin
  select * into m from public.memberships where id = p_membership for update;
  if m.id is null then perform public.d5_raise('D5404', 'Membership not found.'); end if;
  before_m := m;
  if not public.can_manage_roster(m.department_key) then perform public.d5_raise('D5403', 'High command authority is required to change the roster.'); end if;
  if m.profile_id = p.id and not public.is_admin() then perform public.d5_raise('D5403', 'Another commander must change your own membership.'); end if;
  if m.status in ('pending', 'denied') then perform public.d5_raise('D5409', 'Decide the roster request first.'); end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then perform public.d5_raise('D5422', 'Give a short reason for the change.'); end if;
  if m.profile_id is distinct from p.id and not public.outranks_member(m.department_key, m.rank_id) then
    perform public.d5_raise('D5403', 'You can only change members ranked below you.');
  end if;

  if p_rank is not null and p_rank is distinct from m.rank_id then
    select * into r from public.ranks where id = p_rank and department_key = m.department_key and active;
    if r.id is null then perform public.d5_raise('D5422', 'Choose a rank from this department''s ladder.'); end if;
    if not public.can_grant_rank(m.department_key, r) then
      perform public.d5_raise('D5403', 'You can only appoint ranks below your own.');
    end if;
    m.rank_id := r.id; m.rank_name := r.name; m.tier := r.tier; m.is_probationary := (r.tier = 'probationary');
    personnel_change := true;
  end if;
  if p_status is not null and p_status is distinct from m.status then
    if p_status not in ('active', 'suspended', 'removed') then perform public.d5_raise('D5422', 'Invalid status.'); end if;
    m.status := p_status;
    if p_status <> 'active' then m.duty_status := 'off_duty'; end if;
    personnel_change := true;
  end if;
  if p_can_view_personnel is not null and p_can_view_personnel is distinct from m.can_view_personnel then
    if not (public.oversees(m.department_key) or public.has_tier(m.department_key, 'department_head')) then
      perform public.d5_raise('D5403', 'Only a department head or division command can grant personnel-record access.');
    end if;
    m.can_view_personnel := p_can_view_personnel;
    personnel_change := true;
  end if;
  if p_callsign is not null then m.callsign := nullif(trim(p_callsign), ''); end if;
  if p_badge is not null then m.badge := nullif(trim(p_badge), ''); end if;
  if p_clear_leave then m.leave_until := null; elsif p_leave_until is not null then m.leave_until := p_leave_until; end if;
  if p_supervisor is not null then m.supervisor_id := p_supervisor; end if;
  if p_training_officer is not null then m.training_officer_id := p_training_officer; end if;
  if p_subdivisions is not null then m.subdivisions := p_subdivisions; end if;

  update public.memberships set rank_id = m.rank_id, rank_name = m.rank_name, tier = m.tier, is_probationary = m.is_probationary,
    status = m.status, duty_status = m.duty_status, can_view_personnel = m.can_view_personnel, callsign = m.callsign,
    badge = m.badge, leave_until = m.leave_until, supervisor_id = m.supervisor_id,
    training_officer_id = m.training_officer_id, subdivisions = m.subdivisions
  where id = m.id returning * into m;

  insert into public.personnel_records (membership_id, department_key, category, title, detail, before_value, after_value, created_by, created_by_name)
  values (m.id, m.department_key,
    case when before_m.tier is distinct from m.tier and public.tier_rank(m.tier) > public.tier_rank(before_m.tier) then 'promotion'
         when before_m.tier is distinct from m.tier then 'demotion'
         when before_m.rank_id is distinct from m.rank_id then 'rank_change'
         when before_m.status is distinct from m.status then 'status_change'
         when before_m.leave_until is distinct from m.leave_until then 'leave'
         else 'roster_change' end,
    coalesce(case when before_m.rank_id is distinct from m.rank_id then coalesce(before_m.rank_name, '—') || ' → ' || m.rank_name end,
             case when before_m.status is distinct from m.status then 'Status: ' || before_m.status || ' → ' || m.status end,
             'Roster details updated'),
    p_reason,
    jsonb_build_object('rank', before_m.rank_name, 'tier', before_m.tier, 'status', before_m.status, 'callsign', before_m.callsign, 'badge', before_m.badge, 'leave_until', before_m.leave_until),
    jsonb_build_object('rank', m.rank_name, 'tier', m.tier, 'status', m.status, 'callsign', m.callsign, 'badge', m.badge, 'leave_until', m.leave_until),
    p.id, p.display_name);

  if m.profile_id is not null and personnel_change then
    perform public.notify(m.profile_id, 'Your ' || upper(m.department_key) || ' membership changed',
      coalesce(m.rank_name, '') || ' · ' || m.status::text, '/hub/roster/' || m.id, 'roster', 'high', m.department_key, 'membership', m.id, null);
  end if;
  perform public.write_audit(p, 'membership.updated', 'membership', m.id, m.ref, m.department_key, to_jsonb(before_m), to_jsonb(m));
  return m;
end;
$$;
-- True unless the caller is an HCSO Office of the Sheriff member acting on someone of equal or higher rank.
create or replace function public.outranks_member(p_department text, p_member_rank uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  mine public.ranks;
  theirs public.ranks;
begin
  if public.oversees(p_department) or public.is_admin() then return true; end if;
  if p_department <> 'hcso' or not public.has_tier(p_department, 'department_head') or p_member_rank is null then return true; end if;
  select r.* into mine from public.memberships m join public.ranks r on r.id = m.rank_id
  where m.profile_id = auth.uid() and m.department_key = p_department and m.status = 'active';
  select * into theirs from public.ranks where id = p_member_rank;
  return mine.id is not null and mine.sort_order > theirs.sort_order;
end;
$$;

revoke all on function public.can_grant_rank(text, public.ranks) from public, anon;
grant execute on function public.can_grant_rank(text, public.ranks) to authenticated;
revoke all on function public.outranks_member(text, uuid) from public, anon;
grant execute on function public.outranks_member(text, uuid) to authenticated;
