-- Workflow functions. Each one authenticates the caller, checks authority,
-- writes the record, the approval timeline, notifications and the audit log
-- in one transaction. Errors use stable codes the UI maps to messages:
--   D5401 not signed in, D5403 forbidden, D5404 not found,
--   D5409 conflict (already decided, overlap, duplicate), D5422 invalid input.

create or replace function public.d5_raise(code text, msg text)
returns void language plpgsql as $$
begin
  raise exception using errcode = code, message = msg;
end;
$$;

create or replace function public.require_user()
returns public.profiles language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then perform public.d5_raise('D5401', 'Sign in to continue.'); end if;
  return p;
end;
$$;

create or replace function public.write_audit(
  p_actor public.profiles, p_action text, p_entity_type text, p_entity_id uuid,
  p_entity_ref text, p_department text, p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, actor_name, action, entity_type, entity_id, entity_ref, department_key, before_value, after_value)
  values (p_actor.id, p_actor.display_name, p_action, p_entity_type, p_entity_id, p_entity_ref, p_department, p_before, p_after)
$$;

create or replace function public.notify(
  p_profile uuid, p_title text, p_body text, p_link text, p_category text,
  p_priority text default 'normal', p_department text default null,
  p_related_type text default null, p_related_id uuid default null, p_dedupe text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (profile_id, title, body, link, category, priority, department_key, related_type, related_id, dedupe_key)
  values (p_profile, p_title, p_body, p_link, p_category, p_priority, p_department, p_related_type, p_related_id, p_dedupe)
  on conflict (profile_id, dedupe_key) where dedupe_key is not null do nothing
$$;

create or replace function public.week_start_for(ts timestamptz, tz text, starts_on int)
returns date language sql immutable as $$
  select d - ((extract(dow from d)::int - starts_on + 7) % 7)
  from (select (ts at time zone tz)::date as d) x
$$;

create or replace function public.required_tier_for(p_record_type text, p_dept text, p_submitter public.tier)
returns public.tier language sql stable security definer set search_path = public as $$
  select coalesce(
    (select required_tier from public.approval_routes
      where record_type = p_record_type and department_key = p_dept and submitter_tier = p_submitter),
    (select required_tier from public.approval_routes
      where record_type = p_record_type and department_key is null and submitter_tier = p_submitter),
    case p_submitter
      when 'probationary' then 'supervisor'::public.tier
      when 'patrol' then 'supervisor'::public.tier
      when 'supervisor' then 'high_command'::public.tier
      when 'high_command' then 'department_head'::public.tier
      else 'dps'::public.tier
    end)
$$;

-- Can the caller decide a record in `dept` that needs `needed`?
-- Department reviewers need the tier in that department; DPS may review any department.
create or replace function public.can_decide(dept text, needed public.tier)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_dps()
      or (needed <> 'dps' and public.has_tier(dept, needed))
$$;

-- Reviewers to notify for a department and tier (excluding the submitter).
create or replace function public.reviewers_for(dept text, needed public.tier, exclude uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct m.profile_id from public.memberships m join public.departments d on d.key = m.department_key
  where m.status = 'active' and m.profile_id is not null and m.profile_id <> coalesce(exclude, '00000000-0000-0000-0000-000000000000')
    and ((m.department_key = dept and needed <> 'dps' and public.tier_rank(m.tier) >= public.tier_rank(needed))
      or (d.kind = 'oversight' and public.tier_rank(needed) >= public.tier_rank('department_head')))
$$;

-- ---------------------------------------------------------------- session

create or replace function public.set_active_department(p_department text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.profiles := public.require_user();
begin
  if not public.is_member_of(p_department) then
    perform public.d5_raise('D5403', 'You do not hold an active membership in that department.');
  end if;
  update public.profiles set active_department = p_department where id = p.id;
  return p_department;
end;
$$;

create or replace function public.update_my_profile(p_display_name text, p_psn_id text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles := public.require_user();
begin
  if length(trim(coalesce(p_display_name, ''))) < 2 then perform public.d5_raise('D5422', 'Display name is too short.'); end if;
  update public.profiles set display_name = left(trim(p_display_name), 60), psn_id = nullif(left(trim(coalesce(p_psn_id, '')), 32), '')
  where id = p.id;
end;
$$;

create or replace function public.set_duty_status(p_department text, p_status public.duty_status)
returns public.duty_status language plpgsql security definer set search_path = public as $$
declare p public.profiles := public.require_user();
begin
  update public.memberships set duty_status = p_status, duty_changed_at = now()
  where profile_id = p.id and department_key = p_department and status = 'active';
  if not found then perform public.d5_raise('D5403', 'You do not hold an active membership in that department.'); end if;
  -- going on duty in one department takes you off duty in the others
  if p_status = 'on_duty' then
    update public.memberships set duty_status = 'off_duty', duty_changed_at = now()
    where profile_id = p.id and department_key <> p_department and duty_status = 'on_duty';
  end if;
  return p_status;
end;
$$;

create or replace function public.mark_notifications_read(p_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles := public.require_user();
begin
  update public.notifications set read_at = now()
  where profile_id = p.id and read_at is null and (p_id is null or id = p_id);
end;
$$;

-- ------------------------------------------------------------ memberships

-- A signed-in person asks to join a department. Command reviews it.
create or replace function public.request_membership(p_department text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  d public.departments;
  new_id uuid;
begin
  select * into d from public.departments where key = p_department and active;
  if d.key is null then perform public.d5_raise('D5404', 'Department not found.'); end if;
  if d.kind = 'oversight' then perform public.d5_raise('D5403', 'DPS memberships are assigned by DPS command.'); end if;
  if exists (select 1 from public.memberships where profile_id = p.id and department_key = p_department
             and status in ('pending', 'active', 'suspended')) then
    perform public.d5_raise('D5409', 'You already have a membership or request for this department.');
  end if;
  insert into public.memberships (profile_id, display_name, department_key, status, tier, is_probationary, request_note)
  values (p.id, p.display_name, p_department, 'pending', 'probationary', true, left(p_note, 600))
  returning id into new_id;
  insert into public.approval_actions (record_type, record_id, department_key, submitter_id, actor_id, actor_name, action, to_status, reason)
  values ('membership', new_id, p_department, p.id, p.id, p.display_name, 'submitted', 'pending', left(p_note, 600));
  perform public.notify(r, 'Roster request · ' || p.display_name, 'New ' || d.short_name || ' membership request.',
                        '/roster?tab=requests', 'roster', 'normal', p_department, 'membership', new_id, 'mbreq:' || new_id)
  from public.reviewers_for(p_department, 'high_command', p.id) r;
  perform public.write_audit(p, 'membership.requested', 'membership', new_id, null, p_department);
  return new_id;
end;
$$;

-- Approve or deny a pending membership, assigning rank, callsign and badge.
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
    -- only DPS or admin may grant department_head or higher; nobody grants above their own tier
    if public.tier_rank(r.tier) >= public.tier_rank('department_head') and not (public.is_dps() or public.is_admin()) then
      perform public.d5_raise('D5403', 'Only DPS can appoint department heads.');
    end if;
    if not (public.is_dps() or public.is_admin()) and public.tier_rank(r.tier) >= public.tier_rank(public.my_tier(m.department_key)) then
      perform public.d5_raise('D5403', 'You cannot appoint someone at or above your own tier.');
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
      '/', 'roster', 'high', m.department_key, 'membership', m.id, null);
  end if;
  perform public.write_audit(p, 'membership.' || p_action, 'membership', m.id, m.ref, m.department_key, null, to_jsonb(m));
  return m;
end;
$$;

-- Personnel change on an existing membership: rank, callsign, badge, status, leave, supervisor.
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

  if p_rank is not null and p_rank is distinct from m.rank_id then
    select * into r from public.ranks where id = p_rank and department_key = m.department_key and active;
    if r.id is null then perform public.d5_raise('D5422', 'Choose a rank from this department''s ladder.'); end if;
    if public.tier_rank(r.tier) >= public.tier_rank('department_head') and not (public.is_dps() or public.is_admin()) then
      perform public.d5_raise('D5403', 'Only DPS can appoint department heads.');
    end if;
    if not (public.is_dps() or public.is_admin()) and public.tier_rank(r.tier) >= public.tier_rank(public.my_tier(m.department_key)) then
      perform public.d5_raise('D5403', 'You cannot promote someone to or above your own tier.');
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
    if not (public.is_dps() or public.has_tier(m.department_key, 'department_head')) then
      perform public.d5_raise('D5403', 'Only a department head or DPS can grant personnel-record access.');
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
      coalesce(m.rank_name, '') || ' · ' || m.status::text, '/', 'roster', 'high', m.department_key, 'membership', m.id, null);
  end if;
  perform public.write_audit(p, 'membership.updated', 'membership', m.id, m.ref, m.department_key, to_jsonb(before_m), to_jsonb(m));
  return m;
end;
$$;

-- ------------------------------------------------------------- shift logs

create or replace function public.save_shift_log(
  p_id uuid, p_department text, p_started_at timestamptz, p_ended_at timestamptz,
  p_break_minutes int, p_activity_type text, p_summary text, p_cad_reference text,
  p_recording_url text, p_bodycam_status text, p_bodycam_explanation text,
  p_submit boolean, p_expected_version int default null)
returns public.shift_logs language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  m public.memberships;
  d public.departments;
  s public.shift_logs;
  dur int;
  clash public.shift_logs;
  was_status public.approval_status;
begin
  select * into m from public.memberships
   where profile_id = p.id and department_key = p_department and status = 'active';
  if m.id is null then perform public.d5_raise('D5403', 'You do not hold an active membership in ' || upper(p_department) || '.'); end if;
  select * into d from public.departments where key = p_department;

  dur := floor(extract(epoch from (p_ended_at - p_started_at)) / 60)::int - coalesce(p_break_minutes, 0);
  if p_ended_at <= p_started_at then perform public.d5_raise('D5422', 'End time must be after the start time.'); end if;
  if dur < 5 then perform public.d5_raise('D5422', 'A shift must include at least 5 minutes of activity.'); end if;
  if dur > 960 then perform public.d5_raise('D5422', 'A single entry cannot exceed 16 hours. Split it into separate shifts.'); end if;
  if p_started_at > now() + interval '15 minutes' then perform public.d5_raise('D5422', 'Shifts cannot start in the future.'); end if;
  if p_submit and d.bodycam_required and coalesce(p_bodycam_status, 'not_required') not in ('recorded', 'unavailable', 'not_applicable') then
    perform public.d5_raise('D5422', upper(p_department) || ' requires a bodycam status on every submitted shift.');
  end if;
  if p_bodycam_status = 'recorded' and coalesce(p_recording_url, '') !~* '^https?://' then
    perform public.d5_raise('D5422', 'Add the recording link, or choose another bodycam status.');
  end if;
  if p_bodycam_status = 'unavailable' and length(trim(coalesce(p_bodycam_explanation, ''))) < 10 then
    perform public.d5_raise('D5422', 'Explain briefly why footage is unavailable.');
  end if;

  select * into clash from public.shift_logs
   where profile_id = p.id and id is distinct from p_id and status not in ('withdrawn', 'denied', 'archived')
     and tstzrange(started_at, ended_at, '[)') && tstzrange(p_started_at, p_ended_at, '[)')
   limit 1;
  if clash.id is not null then
    perform public.d5_raise('D5409', 'These hours overlap ' || clash.ref || ' (' || upper(clash.department_key) || '). Time is never counted twice; adjust one entry.');
  end if;

  if p_id is null then
    insert into public.shift_logs (profile_id, membership_id, department_key, snapshot_name, snapshot_rank, snapshot_tier,
      snapshot_callsign, snapshot_badge, started_at, ended_at, break_minutes, duration_minutes, week_start, activity_type,
      summary, cad_reference, recording_url, bodycam_status, bodycam_explanation, status, required_tier, submitted_at)
    values (p.id, m.id, m.department_key, m.display_name, m.rank_name, m.tier, m.callsign, m.badge,
      p_started_at, p_ended_at, coalesce(p_break_minutes, 0), dur, public.week_start_for(p_started_at, d.timezone, d.week_starts_on),
      p_activity_type, coalesce(p_summary, ''), nullif(trim(coalesce(p_cad_reference, '')), ''), nullif(trim(coalesce(p_recording_url, '')), ''),
      coalesce(p_bodycam_status, 'not_required'), nullif(trim(coalesce(p_bodycam_explanation, '')), ''),
      (case when p_submit then 'submitted' else 'draft' end)::public.approval_status,
      public.required_tier_for('shift_log', m.department_key, m.tier),
      case when p_submit then now() end)
    returning * into s;
    was_status := null;
  else
    select * into s from public.shift_logs where id = p_id for update;
    if s.id is null then perform public.d5_raise('D5404', 'Shift log not found.'); end if;
    if s.profile_id <> p.id then perform public.d5_raise('D5403', 'You can only edit your own shift logs.'); end if;
    if s.status not in ('draft', 'returned', 'submitted') then perform public.d5_raise('D5409', 'This shift log was already decided and can no longer be edited.'); end if;
    if p_expected_version is not null and p_expected_version <> s.version then
      perform public.d5_raise('D5409', 'This entry changed in another window. Reload to see the latest version.');
    end if;
    if s.department_key <> p_department then perform public.d5_raise('D5422', 'Department cannot change after creation. Withdraw and create a new entry.'); end if;
    was_status := s.status;
    update public.shift_logs set
      snapshot_name = m.display_name, snapshot_rank = m.rank_name, snapshot_tier = m.tier,
      snapshot_callsign = m.callsign, snapshot_badge = m.badge,
      started_at = p_started_at, ended_at = p_ended_at, break_minutes = coalesce(p_break_minutes, 0), duration_minutes = dur,
      week_start = public.week_start_for(p_started_at, d.timezone, d.week_starts_on), activity_type = p_activity_type,
      summary = coalesce(p_summary, ''), cad_reference = nullif(trim(coalesce(p_cad_reference, '')), ''),
      recording_url = nullif(trim(coalesce(p_recording_url, '')), ''), bodycam_status = coalesce(p_bodycam_status, 'not_required'),
      bodycam_explanation = nullif(trim(coalesce(p_bodycam_explanation, '')), ''),
      status = case when p_submit then 'submitted'::public.approval_status else s.status end,
      submitted_at = case when p_submit then now() else s.submitted_at end,
      required_tier = public.required_tier_for('shift_log', m.department_key, m.tier),
      decision_reason = case when p_submit and s.status = 'returned' then null else s.decision_reason end,
      version = s.version + 1
    where id = s.id returning * into s;
  end if;

  if p_submit and (was_status is null or was_status in ('draft', 'returned')) then
    insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, actor_tier, action, from_status, to_status)
    values ('shift_log', s.id, s.ref, s.department_key, p.id, p.id, p.display_name, m.tier,
            case when was_status = 'returned' then 'resubmitted' else 'submitted' end, was_status::text, 'submitted');
    perform public.notify(r, 'Shift log to review · ' || s.snapshot_name,
      s.ref || ' · ' || round(s.duration_minutes / 60.0, 1) || 'h ' || s.activity_type,
      '/approvals?id=' || s.id, 'approval', 'normal', s.department_key, 'shift_log', s.id, 'shiftsub:' || s.id || ':' || s.version)
    from public.reviewers_for(s.department_key, s.required_tier, p.id) r;
  end if;
  perform public.write_audit(p, case when p_submit then 'shift.submitted' else 'shift.saved' end, 'shift_log', s.id, s.ref, s.department_key);
  return s;
exception
  when exclusion_violation then
    perform public.d5_raise('D5409', 'These hours overlap another of your entries. Time is never counted twice; adjust one entry.');
end;
$$;

create or replace function public.withdraw_shift_log(p_id uuid, p_reason text default null)
returns public.shift_logs language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  s public.shift_logs;
  was public.approval_status;
begin
  select * into s from public.shift_logs where id = p_id for update;
  if s.id is null then perform public.d5_raise('D5404', 'Shift log not found.'); end if;
  if s.profile_id <> p.id then perform public.d5_raise('D5403', 'You can only withdraw your own shift logs.'); end if;
  if s.status not in ('draft', 'submitted', 'under_review', 'returned') then
    perform public.d5_raise('D5409', 'A decided shift log cannot be withdrawn.');
  end if;
  was := s.status;
  update public.shift_logs set status = 'withdrawn', decision_reason = nullif(trim(coalesce(p_reason, '')), ''), version = version + 1
  where id = s.id returning * into s;
  insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, action, from_status, to_status, reason)
  values ('shift_log', s.id, s.ref, s.department_key, p.id, p.id, p.display_name, 'withdrawn', was::text, 'withdrawn', p_reason);
  perform public.write_audit(p, 'shift.withdrawn', 'shift_log', s.id, s.ref, s.department_key);
  return s;
end;
$$;

-- The single decision point for shift logs: approve, deny, return, escalate, claim.
create or replace function public.decide_shift_log(p_id uuid, p_action text, p_reason text default null)
returns public.shift_logs language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  s public.shift_logs;
  was public.approval_status;
  reviewer_tier public.tier;
begin
  -- row lock serializes concurrent reviewers; the loser sees the new status below
  select * into s from public.shift_logs where id = p_id for update;
  if s.id is null then perform public.d5_raise('D5404', 'Shift log not found.'); end if;
  if s.profile_id = p.id then perform public.d5_raise('D5403', 'You cannot review your own submission. Another reviewer must decide it.'); end if;
  if not public.can_decide(s.department_key, s.required_tier) then
    perform public.d5_raise('D5403', 'This needs a ' || replace(s.required_tier::text, '_', ' ') || ' or above in ' || upper(s.department_key) || ', or DPS.');
  end if;
  if s.status not in ('submitted', 'under_review') then
    perform public.d5_raise('D5409', 'This shift log was already ' || s.status || ' by ' || coalesce(s.decided_by_name, 'another reviewer') || '.');
  end if;
  if p_action in ('deny', 'return') and length(trim(coalesce(p_reason, ''))) < 5 then
    perform public.d5_raise('D5422', case when p_action = 'deny' then 'A denial needs a reason the member can act on.' else 'Say what needs correcting.' end);
  end if;

  was := s.status;
  reviewer_tier := coalesce(public.my_tier(s.department_key), case when public.is_dps() then 'dps'::public.tier end);
  if p_action = 'approve' then
    update public.shift_logs set status = 'approved', decided_at = now(), decided_by = p.id, decided_by_name = p.display_name,
      decision_reason = nullif(trim(coalesce(p_reason, '')), ''), version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'deny' then
    update public.shift_logs set status = 'denied', decided_at = now(), decided_by = p.id, decided_by_name = p.display_name,
      decision_reason = p_reason, version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'return' then
    update public.shift_logs set status = 'returned', decided_at = now(), decided_by = p.id, decided_by_name = p.display_name,
      decision_reason = p_reason, version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'escalate' then
    if s.required_tier = 'dps' then perform public.d5_raise('D5409', 'This is already with DPS.'); end if;
    update public.shift_logs set status = 'under_review', required_tier = 'dps', assigned_to = null,
      decision_reason = nullif(trim(coalesce(p_reason, '')), ''), version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'claim' then
    update public.shift_logs set status = 'under_review', assigned_to = p.id, version = version + 1 where id = s.id returning * into s;
  else
    perform public.d5_raise('D5422', 'Unknown action.');
  end if;

  insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, actor_tier, action, from_status, to_status, reason)
  values ('shift_log', s.id, s.ref, s.department_key, s.profile_id, p.id, p.display_name, reviewer_tier,
          case p_action when 'approve' then 'approved' when 'deny' then 'denied' when 'return' then 'returned'
                        when 'escalate' then 'escalated' else 'claimed' end,
          was::text, s.status::text, p_reason);

  if p_action in ('approve', 'deny', 'return') then
    perform public.notify(s.profile_id,
      'Shift log ' || case p_action when 'approve' then 'approved' when 'deny' then 'denied' else 'returned for correction' end || ' · ' || s.ref,
      coalesce(p_reason, round(s.duration_minutes / 60.0, 1) || 'h counted toward this week.'),
      '/shifts?id=' || s.id, 'approval', case when p_action = 'approve' then 'normal' else 'high' end,
      s.department_key, 'shift_log', s.id, null);
  elsif p_action = 'escalate' then
    perform public.notify(r, 'Escalated to DPS · ' || s.ref, coalesce(p_reason, s.snapshot_name), '/approvals?id=' || s.id,
      'approval', 'high', s.department_key, 'shift_log', s.id, 'shiftesc:' || s.id)
    from public.reviewers_for(s.department_key, 'dps', s.profile_id) r;
  end if;
  perform public.write_audit(p, 'shift.' || p_action, 'shift_log', s.id, s.ref, s.department_key,
    jsonb_build_object('status', was), jsonb_build_object('status', s.status, 'reason', p_reason));
  return s;
end;
$$;

-- Weekly activity for the caller. Approved and pending minutes are reported separately.
-- Overlap is impossible by constraint, so summing never double counts across departments.
-- Mode 'combined' (default) measures one district quota; 'per_department' measures each.
create or replace function public.my_activity(p_weeks int default 6)
returns table (week_start date, department_key text, approved_minutes int, pending_minutes int,
               returned_count int, quota_minutes int, exempt boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  primary_dept public.departments;
  this_week date;
begin
  select d.* into primary_dept from public.departments d
   where d.key = coalesce(p.active_department, (select m.department_key from public.memberships m where m.profile_id = p.id and m.status = 'active' order by m.join_date nulls last limit 1));
  this_week := public.week_start_for(now(), coalesce(primary_dept.timezone, 'America/New_York'), coalesce(primary_dept.week_starts_on, 1));
  return query
  with weeks as (
    select (this_week - (7 * g))::date as ws from generate_series(0, greatest(p_weeks, 1) - 1) g
  ), depts as (
    select m.department_key, m.leave_until, d.quota_minutes from public.memberships m join public.departments d on d.key = m.department_key
    where m.profile_id = p.id and m.status = 'active' and d.kind = 'department'
  )
  select w.ws, dp.department_key,
    coalesce(sum(s.duration_minutes) filter (where s.status = 'approved'), 0)::int,
    coalesce(sum(s.duration_minutes) filter (where s.status in ('submitted', 'under_review')), 0)::int,
    count(s.id) filter (where s.status = 'returned')::int,
    dp.quota_minutes,
    (dp.leave_until is not null and dp.leave_until >= w.ws)
  from weeks w cross join depts dp
  left join public.shift_logs s on s.profile_id = p.id and s.department_key = dp.department_key and s.week_start = w.ws
  group by w.ws, dp.department_key, dp.quota_minutes, dp.leave_until
  order by w.ws desc, dp.department_key;
end;
$$;

-- Department compliance for supervisors: members below quota this week (flag only; never a strike).
create or replace function public.department_compliance(p_department text)
returns table (membership_id uuid, display_name text, callsign text, rank_name text, tier public.tier,
               approved_minutes int, pending_minutes int, district_minutes int, quota_minutes int, on_leave boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  d public.departments;
  ws date;
  mode text;
begin
  perform public.require_user();
  if not public.can_supervise(p_department) then perform public.d5_raise('D5403', 'Supervisor authority is required.'); end if;
  select * into d from public.departments where key = p_department;
  ws := public.week_start_for(now(), d.timezone, d.week_starts_on);
  select coalesce(value #>> '{}', 'combined') into mode from public.app_settings where key = 'dual_membership_mode';
  return query
  select m.id, m.display_name, m.callsign, m.rank_name, m.tier,
    coalesce(sum(s.duration_minutes) filter (where s.status = 'approved' and s.department_key = p_department), 0)::int,
    coalesce(sum(s.duration_minutes) filter (where s.status in ('submitted', 'under_review') and s.department_key = p_department), 0)::int,
    coalesce(sum(s.duration_minutes) filter (where s.status = 'approved'), 0)::int,
    d.quota_minutes,
    (m.leave_until is not null and m.leave_until >= ws)
  from public.memberships m
  left join public.shift_logs s on s.profile_id = m.profile_id and s.week_start = ws
  where m.department_key = p_department and m.status = 'active'
  group by m.id, m.display_name, m.callsign, m.rank_name, m.tier, m.leave_until
  order by 6 asc;
end;
$$;

-- ---------------------------------------------------- announcements/policy

create or replace function public.save_announcement(
  p_id uuid, p_title text, p_body text, p_scope text, p_department text, p_priority text,
  p_audience_min_tier public.tier, p_pinned boolean, p_publish boolean)
returns public.announcements language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  a public.announcements;
begin
  if p_id is not null then
    select * into a from public.announcements where id = p_id for update;
    if a.id is null then perform public.d5_raise('D5404', 'Announcement not found.'); end if;
    -- authority comes from the stored record; scope cannot change after creation
    p_scope := a.scope; p_department := a.department_key;
  end if;
  if p_scope not in ('district', 'department') then perform public.d5_raise('D5422', 'Unknown scope.'); end if;
  if p_scope = 'district' and not public.is_dps() then perform public.d5_raise('D5403', 'District announcements are published by DPS.'); end if;
  if p_scope = 'department' and not (public.has_tier(p_department, 'high_command') or public.is_dps()) then
    perform public.d5_raise('D5403', 'High command authority is required to publish department announcements.');
  end if;
  if p_id is null then
    insert into public.announcements (title, body, scope, department_key, priority, audience_min_tier, pinned, status, published_at, author_id, author_name)
    values (p_title, coalesce(p_body, ''), p_scope, case when p_scope = 'department' then p_department end, coalesce(p_priority, 'normal'),
            coalesce(p_audience_min_tier, 'probationary'), coalesce(p_pinned, false),
            case when p_publish then 'published' else 'draft' end, case when p_publish then now() end, p.id, p.display_name)
    returning * into a;
  else
    update public.announcements set title = p_title, body = coalesce(p_body, ''), priority = coalesce(p_priority, priority),
      audience_min_tier = coalesce(p_audience_min_tier, audience_min_tier), pinned = coalesce(p_pinned, pinned),
      status = case when p_publish then 'published' else status end,
      published_at = case when p_publish and published_at is null then now() else published_at end
    where id = a.id returning * into a;
  end if;
  perform public.write_audit(p, case when p_publish then 'announcement.published' else 'announcement.saved' end, 'announcement', a.id, a.ref, a.department_key);
  return a;
end;
$$;

-- Separate approval to show a published announcement on the public site.
create or replace function public.set_announcement_public(p_id uuid, p_public boolean)
returns public.announcements language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  a public.announcements;
begin
  select * into a from public.announcements where id = p_id for update;
  if a.id is null then perform public.d5_raise('D5404', 'Announcement not found.'); end if;
  if not (public.is_dps() or (a.scope = 'department' and public.has_tier(a.department_key, 'department_head'))) then
    perform public.d5_raise('D5403', 'A department head or DPS must approve public content.');
  end if;
  if p_public and a.status <> 'published' then perform public.d5_raise('D5409', 'Publish it internally before approving it for the public site.'); end if;
  update public.announcements set is_public = p_public,
    public_approved_by = case when p_public then p.id end, public_approved_at = case when p_public then now() end
  where id = a.id returning * into a;
  perform public.write_audit(p, case when p_public then 'announcement.public_approved' else 'announcement.public_removed' end, 'announcement', a.id, a.ref, a.department_key);
  return a;
end;
$$;

create or replace function public.acknowledge_policy(p_policy uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  pol public.policies;
begin
  select * into pol from public.policies where id = p_policy and status = 'approved';
  if pol.id is null then perform public.d5_raise('D5404', 'Policy not found.'); end if;
  if not public.is_active_member() then perform public.d5_raise('D5403', 'Active membership required.'); end if;
  insert into public.policy_acknowledgments (policy_id, profile_id, policy_version) values (pol.id, p.id, pol.version)
  on conflict do nothing;
end;
$$;

create or replace function public.save_policy(
  p_id uuid, p_title text, p_category text, p_department text, p_version text, p_summary text,
  p_body text, p_source_url text, p_requires_ack boolean, p_effective date, p_approve boolean)
returns public.policies language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  pol public.policies;
begin
  if p_id is not null then
    select * into pol from public.policies where id = p_id for update;
    if pol.id is null then perform public.d5_raise('D5404', 'Policy not found.'); end if;
    p_department := pol.department_key;
  end if;
  if p_department is null and not public.is_dps() then perform public.d5_raise('D5403', 'District policies are managed by DPS.'); end if;
  if p_department is not null and not (public.has_tier(p_department, 'department_head') or public.is_dps()) then
    perform public.d5_raise('D5403', 'A department head or DPS manages department policies.');
  end if;
  if p_id is null then
    insert into public.policies (title, category, department_key, version, summary, body, source_url, requires_acknowledgment, effective_date, status, approved_by, approved_at)
    values (p_title, coalesce(p_category, 'sop'), p_department, coalesce(p_version, '1.0'), p_summary, p_body, p_source_url, coalesce(p_requires_ack, false), p_effective,
            case when p_approve then 'approved' else 'draft' end, case when p_approve then p.id end, case when p_approve then now() end)
    returning * into pol;
  else
    update public.policies set title = p_title, category = coalesce(p_category, category), version = coalesce(p_version, version),
      summary = p_summary, body = p_body, source_url = p_source_url, requires_acknowledgment = coalesce(p_requires_ack, requires_acknowledgment),
      effective_date = p_effective, status = case when p_approve then 'approved' else status end,
      approved_by = case when p_approve then p.id else approved_by end, approved_at = case when p_approve then now() else approved_at end
    where id = pol.id returning * into pol;
  end if;
  perform public.write_audit(p, 'policy.saved', 'policy', pol.id, pol.ref, pol.department_key);
  return pol;
end;
$$;

-- --------------------------------------------------------- administration

create or replace function public.admin_update_department(
  p_key text, p_quota_minutes int, p_week_starts_on int, p_timezone text,
  p_bodycam_required boolean, p_bodycam_policy_text text, p_bodycam_policy_url text)
returns public.departments language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  before_d public.departments;
  d public.departments;
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
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
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
  if p_id is null then
    insert into public.ranks (department_key, name, abbreviation, tier, sort_order, is_sample, active)
    values (p_department, p_name, p_abbreviation, p_tier, coalesce(p_sort, 0), false, coalesce(p_active, true)) returning * into r;
  else
    update public.ranks set name = p_name, abbreviation = p_abbreviation, tier = p_tier, sort_order = coalesce(p_sort, sort_order),
      active = coalesce(p_active, active), is_sample = false where id = p_id returning * into r;
    if r.id is null then perform public.d5_raise('D5404', 'Rank not found.'); end if;
  end if;
  perform public.write_audit(p, 'rank.saved', 'rank', r.id, r.name, r.department_key, null, to_jsonb(r));
  return r;
end;
$$;

-- Roster seeding for an administrator: create a membership not yet linked to an account.
-- It links itself when that person signs in with the matching Discord ID.
create or replace function public.admin_add_roster_member(
  p_department text, p_display_name text, p_discord_id text, p_rank uuid, p_callsign text, p_badge text, p_join_date date)
returns public.memberships language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  r public.ranks;
  m public.memberships;
  linked uuid;
begin
  if not public.can_manage_roster(p_department) then perform public.d5_raise('D5403', 'High command authority is required.'); end if;
  select * into r from public.ranks where id = p_rank and department_key = p_department;
  if r.id is null then perform public.d5_raise('D5422', 'Choose a rank from this department''s ladder.'); end if;
  if public.tier_rank(r.tier) >= public.tier_rank('department_head') and not (public.is_dps() or public.is_admin()) then
    perform public.d5_raise('D5403', 'Only DPS can appoint department heads.');
  end if;
  select id into linked from public.profiles where discord_id = nullif(trim(p_discord_id), '');
  insert into public.memberships (profile_id, display_name, department_key, rank_id, rank_name, tier, callsign, badge, status, is_probationary, join_date, request_note)
  values (linked, p_display_name, p_department, r.id, r.name, r.tier, nullif(trim(p_callsign), ''), nullif(trim(p_badge), ''), 'active',
          r.tier = 'probationary', coalesce(p_join_date, current_date), case when linked is null then 'discord:' || nullif(trim(p_discord_id), '') end)
  returning * into m;
  perform public.write_audit(p, 'membership.added', 'membership', m.id, m.ref, m.department_key, null, to_jsonb(m));
  return m;
end;
$$;

-- Link roster rows imported by Discord ID to the account that just signed in.
create or replace function public.link_roster_on_signin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.discord_id is not null then
    update public.memberships set profile_id = new.id
    where profile_id is null and request_note = 'discord:' || new.discord_id;
  end if;
  return new;
end;
$$;

create trigger profiles_link_roster after insert on public.profiles
  for each row execute function public.link_roster_on_signin();

-- Functions are the write path. Lock them to signed-in callers.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- policy helpers must stay callable by anon so anonymous policy checks evaluate
grant execute on function public.tier_rank(public.tier), public.is_admin(), public.my_tier(text), public.has_tier(text, public.tier),
  public.is_active_member(), public.is_member_of(text), public.is_dps(), public.can_read_department(text),
  public.can_supervise(text), public.can_view_personnel(text), public.can_manage_roster(text), public.me() to anon;
-- internal helpers are not part of the API
revoke execute on function public.write_audit(public.profiles, text, text, uuid, text, text, jsonb, jsonb),
  public.notify(uuid, text, text, text, text, text, text, text, uuid, text),
  public.d5_raise(text, text), public.handle_new_user(), public.link_roster_on_signin(),
  public.audit_log_immutable(), public.touch_updated_at() from authenticated;
