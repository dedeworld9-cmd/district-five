-- Divisions: District Five now covers law enforcement, Fire/EMS and (later) Dispatch.
-- Each department belongs to a division. An oversight department (DPS, Fire/EMS
-- Administration) oversees only the divisions listed in its `oversees` column, so one
-- division's command cannot read or decide another division's records.

alter table public.departments
  add column division text not null default 'leo' check (division in ('leo', 'fire_ems', 'dispatch')),
  add column oversees text[] not null default '{}';

update public.departments set oversees = '{leo}' where key = 'dps';

insert into public.departments (key, name, short_name, kind, division, oversees, tagline, accent, sort_order, bodycam_required) values
  ('safd', 'San Andreas Fire Department', 'SAFD', 'department', 'fire_ems', '{}', 'Fire and rescue', '#c8553d', 3, false),
  ('saems', 'San Andreas Emergency Medical Services', 'SAEMS', 'department', 'fire_ems', '{}', 'Emergency medical care', '#6fa8c9', 4, false),
  ('fems', 'Fire/EMS Administration', 'Fire/EMS Admin', 'oversight', 'fire_ems', '{fire_ems}', 'SAFD and SAEMS command', '#d8dde6', 0, false)
on conflict (key) do nothing;

-- Fire/EMS shifts use their own activity types.
alter table public.shift_logs drop constraint if exists shift_logs_activity_type_check;
alter table public.shift_logs add constraint shift_logs_activity_type_check check (activity_type in (
  'patrol', 'traffic', 'training', 'administrative', 'special_assignment', 'supervision',
  'fire_response', 'ems_response', 'station_duty', 'dispatch'));

-- ---------------------------------------------------------------- helpers

create or replace function public.division_of(dept text)
returns text language sql stable security definer set search_path = public as $$
  select division from public.departments where key = dept
$$;

-- Does the caller hold command over this department: an active membership in an oversight
-- department whose `oversees` includes the department's division, or in that oversight
-- department itself?
create or replace function public.oversees(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select dept is not null and exists (
    select 1 from public.memberships m join public.departments d on d.key = m.department_key
    where m.profile_id = auth.uid() and m.status = 'active' and d.kind = 'oversight'
      and (d.key = dept or public.division_of(dept) = any(d.oversees)))
$$;

-- is_dps() keeps its meaning of "holds any division command". It now gates only
-- district-wide items (district announcements and policies), never a department's records.

create or replace function public.can_read_department(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member_of(dept) or public.oversees(dept)
$$;

create or replace function public.can_supervise(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_tier(dept, 'supervisor') or public.oversees(dept)
$$;

create or replace function public.can_view_personnel(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.departments d on d.key = m.department_key
    where m.profile_id = auth.uid() and m.status = 'active'
      and ((m.department_key = dept and (public.tier_rank(m.tier) >= public.tier_rank('department_head') or m.can_view_personnel))
        or (d.kind = 'oversight' and m.can_view_personnel and public.division_of(dept) = any(d.oversees)))
  )
$$;

create or replace function public.can_manage_roster(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_tier(dept, 'high_command') or public.oversees(dept) or public.is_admin()
$$;

-- ----------------------------------------------------------- row security

drop policy profiles_supervised on public.profiles;
create policy profiles_supervised on public.profiles for select using (
  public.is_admin() or exists (
    select 1 from public.memberships m
    where m.profile_id = profiles.id and m.status in ('active', 'pending', 'suspended')
      and public.can_supervise(m.department_key)
  )
);

drop policy announcements_members on public.announcements;
create policy announcements_members on public.announcements for select to authenticated using (
  (status = 'published' and (
     (scope = 'district' and public.is_active_member() and (
        public.is_dps() or exists (select 1 from public.memberships m where m.profile_id = auth.uid()
          and m.status = 'active' and public.tier_rank(m.tier) >= public.tier_rank(announcements.audience_min_tier))))
     or (scope = 'department' and public.has_tier(department_key, audience_min_tier))
     or (scope = 'department' and public.oversees(department_key))
     or (is_public and public_approved_at is not null)))
  or (status <> 'published' and (
     (scope = 'district' and public.is_dps())
     or (scope = 'department' and (public.oversees(department_key) or public.has_tier(department_key, 'high_command')))))
);

drop policy policies_read on public.policies;
create policy policies_read on public.policies for select to authenticated using (
  (status in ('approved', 'superseded') and public.is_active_member()
     and (department_key is null or public.can_read_department(department_key)))
  or (department_key is null and public.is_dps())
  or public.oversees(department_key)
  or (department_key is not null and public.has_tier(department_key, 'high_command'))
);

drop policy policy_acks_own on public.policy_acknowledgments;
create policy policy_acks_own on public.policy_acknowledgments for select using (
  profile_id = auth.uid() or exists (
    select 1 from public.policies pol where pol.id = policy_acknowledgments.policy_id
      and ((pol.department_key is null and public.is_dps())
        or public.oversees(pol.department_key)
        or public.has_tier(pol.department_key, 'high_command')))
);

drop policy audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (
  public.is_admin()
  or (department_key is null and public.is_dps())
  or public.oversees(department_key)
  or (department_key is not null and public.has_tier(department_key, 'department_head'))
);

-- ----------------------------------------------- workflows, now division-scoped

create or replace function public.can_decide(dept text, needed public.tier)
returns boolean language sql stable security definer set search_path = public as $$
  select public.oversees(dept)
      or (needed <> 'dps' and public.has_tier(dept, needed))
$$;

create or replace function public.reviewers_for(dept text, needed public.tier, exclude uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct m.profile_id from public.memberships m join public.departments d on d.key = m.department_key
  where m.status = 'active' and m.profile_id is not null and m.profile_id <> coalesce(exclude, '00000000-0000-0000-0000-000000000000')
    and ((m.department_key = dept and needed <> 'dps' and public.tier_rank(m.tier) >= public.tier_rank(needed))
      or (d.kind = 'oversight' and public.division_of(dept) = any(d.oversees) and public.tier_rank(needed) >= public.tier_rank('department_head')))
$$;

create or replace function public.request_membership(p_department text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  d public.departments;
  new_id uuid;
begin
  select * into d from public.departments where key = p_department and active;
  if d.key is null then perform public.d5_raise('D5404', 'Department not found.'); end if;
  if d.kind = 'oversight' then perform public.d5_raise('D5403', 'Command memberships are assigned by division command.'); end if;
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
                        '/hub/roster?dept=' || p_department, 'roster', 'normal', p_department, 'membership', new_id, 'mbreq:' || new_id)
  from public.reviewers_for(p_department, 'high_command', p.id) r;
  perform public.write_audit(p, 'membership.requested', 'membership', new_id, null, p_department);
  return new_id;
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
    -- only division command or admin may grant department_head or higher; nobody grants above their own tier
    if public.tier_rank(r.tier) >= public.tier_rank('department_head') and not (public.oversees(m.department_key) or public.is_admin()) then
      perform public.d5_raise('D5403', 'Only division command can appoint department heads.');
    end if;
    if not (public.oversees(m.department_key) or public.is_admin()) and public.tier_rank(r.tier) >= public.tier_rank(public.my_tier(m.department_key)) then
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

  if p_rank is not null and p_rank is distinct from m.rank_id then
    select * into r from public.ranks where id = p_rank and department_key = m.department_key and active;
    if r.id is null then perform public.d5_raise('D5422', 'Choose a rank from this department''s ladder.'); end if;
    if public.tier_rank(r.tier) >= public.tier_rank('department_head') and not (public.oversees(m.department_key) or public.is_admin()) then
      perform public.d5_raise('D5403', 'Only division command can appoint department heads.');
    end if;
    if not (public.oversees(m.department_key) or public.is_admin()) and public.tier_rank(r.tier) >= public.tier_rank(public.my_tier(m.department_key)) then
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
  reviewer_tier := coalesce(public.my_tier(s.department_key), case when public.oversees(s.department_key) then 'dps'::public.tier end);
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
      '/hub/shifts/' || s.id, 'approval', case when p_action = 'approve' then 'normal' else 'high' end,
      s.department_key, 'shift_log', s.id, null);
  elsif p_action = 'escalate' then
    perform public.notify(r, 'Escalated to DPS · ' || s.ref, coalesce(p_reason, s.snapshot_name), '/hub/shifts/' || s.id,
      'approval', 'high', s.department_key, 'shift_log', s.id, 'shiftesc:' || s.id)
    from public.reviewers_for(s.department_key, 'dps', s.profile_id) r;
  end if;
  perform public.write_audit(p, 'shift.' || p_action, 'shift_log', s.id, s.ref, s.department_key,
    jsonb_build_object('status', was), jsonb_build_object('status', s.status, 'reason', p_reason));
  return s;
end;
$$;

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
  if p_scope = 'district' and not public.is_dps() then perform public.d5_raise('D5403', 'District announcements are published by division command.'); end if;
  if p_scope = 'department' and not (public.has_tier(p_department, 'high_command') or public.oversees(p_department)) then
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

create or replace function public.set_announcement_public(p_id uuid, p_public boolean)
returns public.announcements language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  a public.announcements;
begin
  select * into a from public.announcements where id = p_id for update;
  if a.id is null then perform public.d5_raise('D5404', 'Announcement not found.'); end if;
  if not ((a.scope = 'district' and public.is_dps()) or public.oversees(a.department_key) or (a.scope = 'department' and public.has_tier(a.department_key, 'department_head'))) then
    perform public.d5_raise('D5403', 'A department head or division command must approve public content.');
  end if;
  if p_public and a.status <> 'published' then perform public.d5_raise('D5409', 'Publish it internally before approving it for the public site.'); end if;
  update public.announcements set is_public = p_public,
    public_approved_by = case when p_public then p.id end, public_approved_at = case when p_public then now() end
  where id = a.id returning * into a;
  perform public.write_audit(p, case when p_public then 'announcement.public_approved' else 'announcement.public_removed' end, 'announcement', a.id, a.ref, a.department_key);
  return a;
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
  if p_department is null and not public.is_dps() then perform public.d5_raise('D5403', 'District policies are managed by division command.'); end if;
  if p_department is not null and not (public.has_tier(p_department, 'department_head') or public.oversees(p_department)) then
    perform public.d5_raise('D5403', 'A department head or division command manages department policies.');
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
  if public.tier_rank(r.tier) >= public.tier_rank('department_head') and not (public.oversees(p_department) or public.is_admin()) then
    perform public.d5_raise('D5403', 'Only division command can appoint department heads.');
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


-- policy helpers, so anonymous policy checks must be able to evaluate them too
revoke execute on function public.division_of(text), public.oversees(text) from public;
grant execute on function public.division_of(text), public.oversees(text) to anon, authenticated;
