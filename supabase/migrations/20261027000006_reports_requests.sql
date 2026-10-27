-- Reports, requests, training and live boards, modelled on the SAHP portal and the
-- combined forms, for every division. One `submissions` table holds every report and
-- request; each kind has its own required fields, checked in submission_check().
-- Approval side effects (certifications, subdivisions, leave) happen in the same
-- transaction as the decision.

-- DPS seats cover LEO and Fire/EMS operations, so DPS oversees every division.
-- Fire/EMS Administration remains SAFD and SAEMS's own command.
update public.departments set oversees = '{leo,fire_ems,dispatch}' where key = 'dps';

-- DPS ladder as listed on the SAHP portal roster (E-01 to E-06). Still samples until confirmed.
update public.ranks set name = 'Commissioner of DPS', abbreviation = 'E-01', sort_order = 60 where department_key = 'dps' and name = 'Commissioner';
update public.ranks set name = 'Deputy Commissioner of DPS', abbreviation = 'E-02', sort_order = 50 where department_key = 'dps' and name = 'Deputy Commissioner';
update public.ranks set name = 'Assistant Commissioner of DPS', abbreviation = 'E-03', sort_order = 40 where department_key = 'dps' and name = 'Assistant Commissioner';
update public.ranks set name = 'Captain of DPS', abbreviation = 'E-04', sort_order = 30 where department_key = 'dps' and name = 'DPS Captain';
update public.ranks set name = 'Officer of LEO Operations', abbreviation = 'E-05', sort_order = 20 where department_key = 'dps' and name = 'DPS Officer';
-- Existing databases only; fresh installs get the same rows from seed.sql.
insert into public.ranks (department_key, name, abbreviation, tier, sort_order)
select 'dps', 'Officer of Fire/EMS Operations', 'E-06', 'dps', 10
where exists (select 1 from public.departments where key = 'dps')
on conflict (department_key, name) do nothing;
update public.memberships m set rank_name = r.name from public.ranks r where m.rank_id = r.id and m.department_key = 'dps';

-- ------------------------------------------------- certifications & subdivisions

-- What each department offers. Administrators edit these; closed options refuse new requests.
create table public.department_options (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references public.departments(key),
  kind text not null check (kind in ('certification', 'subdivision')),
  name text not null check (length(name) between 1 and 60),
  description text check (length(description) <= 300),
  min_tier public.tier not null default 'probationary',
  is_open boolean not null default true,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (department_key, kind, name)
);

create table public.member_certifications (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id),
  department_key text not null references public.departments(key),
  name text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  granted_by_name text,
  source_submission uuid,
  revoked_at timestamptz
);
create unique index member_certifications_one on public.member_certifications (membership_id, name) where revoked_at is null;

-- ---------------------------------------------------------- submissions

create sequence public.ref_submission;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('D5-RQ-' || lpad(nextval('public.ref_submission')::text, 5, '0')),
  kind text not null check (kind in (
    'incident', 'use_of_force', 'fire_incident', 'patient_care',
    'warrant', 'bolo', 'certification', 'subdivision', 'leave', 'fto_log')),
  department_key text not null references public.departments(key),
  profile_id uuid not null references public.profiles(id),
  membership_id uuid not null references public.memberships(id),
  snapshot_name text not null,
  snapshot_rank text,
  snapshot_tier public.tier not null,
  snapshot_callsign text,
  snapshot_badge text,
  title text not null check (length(title) between 1 and 140),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and length(details::text) <= 20000),
  evidence_url text check (evidence_url is null or evidence_url ~* '^https?://'),
  occurred_on date,
  expires_at timestamptz,
  subject_membership uuid references public.memberships(id),
  status public.approval_status not null default 'draft',
  required_tier public.tier not null default 'supervisor',
  assigned_to uuid references public.profiles(id),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  decided_by_name text,
  decision_reason text,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_queue on public.submissions (department_key, status, required_tier);
create index submissions_mine on public.submissions (profile_id, created_at desc);
create index submissions_active on public.submissions (kind, status, expires_at) where kind in ('warrant', 'bolo');
create trigger submissions_touch before update on public.submissions for each row execute function public.touch_updated_at();

alter table public.approval_actions drop constraint if exists approval_actions_action_check;
alter table public.approval_actions add constraint approval_actions_action_check check (action in (
  'created', 'submitted', 'resubmitted', 'claimed', 'assigned', 'approved', 'denied',
  'returned', 'escalated', 'withdrawn', 'commented', 'archived'));

-- Use of force goes straight to department heads; subdivision applications to high command.
insert into public.approval_routes (record_type, department_key, submitter_tier, required_tier) values
  ('use_of_force', null, 'probationary', 'department_head'),
  ('use_of_force', null, 'patrol', 'department_head'),
  ('use_of_force', null, 'supervisor', 'department_head'),
  ('use_of_force', null, 'high_command', 'department_head'),
  ('subdivision', null, 'probationary', 'high_command'),
  ('subdivision', null, 'patrol', 'high_command'),
  ('subdivision', null, 'supervisor', 'high_command')
on conflict do nothing;

-- Which kinds each division files.
create or replace function public.kind_allowed(p_kind text, p_division text)
returns boolean language sql immutable as $$
  select case p_division
    when 'leo' then p_kind in ('incident', 'use_of_force', 'warrant', 'bolo', 'certification', 'subdivision', 'leave', 'fto_log')
    when 'fire_ems' then p_kind in ('fire_incident', 'patient_care', 'certification', 'subdivision', 'leave', 'fto_log')
    when 'dispatch' then p_kind in ('certification', 'leave')
    else false
  end
$$;

-- An active member of any department in this division.
create or replace function public.in_division(p_division text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m join public.departments d on d.key = m.department_key
                 where m.profile_id = auth.uid() and m.status = 'active' and d.division = p_division)
$$;

-- -------------------------------------------------------------- validation

create or replace function public.d5_text(j jsonb, k text)
returns text language sql immutable as $$ select nullif(trim(coalesce(j ->> k, '')), '') $$;

-- Required fields and allowed values for each kind. Raises D5422 with a message the member can act on.
create or replace function public.submission_check(
  p_kind text, p_department text, m public.memberships, j jsonb, p_evidence text,
  p_occurred date, p_expires timestamptz, p_subject uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  need text[];
  k text;
  opt public.department_options;
  subj public.memberships;
  label jsonb := '{"location":"location","incident_type":"incident type","summary":"summary","force_type":"type of force",
    "scene":"scene description","subject_name":"subject name","charges":"offense or charges","probable_cause":"probable cause",
    "subject":"subject or vehicle","description":"description","reason":"reason","requested":"what you are requesting",
    "why":"why you are requesting it","meets_requirements":"whether you meet the requirements","start_date":"start date",
    "end_date":"end date","complaint":"chief complaint","treatment":"treatment given","disposition":"disposition",
    "notes":"ride-along notes","recommendation":"recommendation"}';
begin
  need := case p_kind
    when 'incident' then array['location', 'incident_type', 'summary']
    when 'use_of_force' then array['force_type', 'scene']
    when 'fire_incident' then array['location', 'incident_type', 'summary']
    when 'patient_care' then array['location', 'complaint', 'treatment', 'disposition']
    when 'warrant' then array['subject_name', 'charges', 'probable_cause']
    when 'bolo' then array['subject', 'description', 'reason']
    when 'certification' then array['requested', 'why', 'meets_requirements']
    when 'subdivision' then array['requested', 'why']
    when 'leave' then array['start_date', 'end_date', 'reason']
    when 'fto_log' then array['notes', 'recommendation']
  end;
  foreach k in array need loop
    if public.d5_text(j, k) is null then
      perform public.d5_raise('D5422', 'Add the ' || coalesce(label ->> k, replace(k, '_', ' ')) || '.');
    end if;
  end loop;

  if p_kind in ('incident', 'use_of_force', 'fire_incident', 'patient_care', 'fto_log') then
    if p_occurred is null then perform public.d5_raise('D5422', 'Add the date it happened.'); end if;
    if p_occurred > current_date + 1 then perform public.d5_raise('D5422', 'The date cannot be in the future.'); end if;
  end if;
  if p_kind = 'incident' and j ->> 'incident_type' not in ('Traffic Stop', 'Arrest', 'Pursuit', 'Disturbance', 'Other') then
    perform public.d5_raise('D5422', 'Choose an incident type from the list.');
  end if;
  if p_kind = 'use_of_force' then
    if j ->> 'force_type' not in ('Verbal', 'Physical', 'Less lethal', 'Lethal') then
      perform public.d5_raise('D5422', 'Choose the type of force from the list.');
    end if;
    if p_evidence is null then perform public.d5_raise('D5422', 'Use of force reports need a video evidence link.'); end if;
  end if;
  if p_kind = 'fire_incident' and j ->> 'incident_type' not in
     ('Structure fire', 'Vehicle fire', 'Brush fire', 'Rescue', 'Medical assist', 'Hazmat', 'Other') then
    perform public.d5_raise('D5422', 'Choose an incident type from the list.');
  end if;
  if p_kind = 'patient_care' and j ->> 'disposition' not in
     ('Transported', 'Treated and released', 'Refused care', 'Deceased on scene') then
    perform public.d5_raise('D5422', 'Choose a disposition from the list.');
  end if;
  if p_kind in ('warrant', 'bolo') then
    if p_expires is null then perform public.d5_raise('D5422', 'Add the requested expiration.'); end if;
    if p_expires <= now() then perform public.d5_raise('D5422', 'The expiration must be in the future.'); end if;
    if p_expires > now() + interval '90 days' then perform public.d5_raise('D5422', 'Requests can last at most 90 days.'); end if;
  end if;
  if p_kind in ('certification', 'subdivision') then
    select * into opt from public.department_options
     where department_key = p_department and kind = p_kind and name = j ->> 'requested' and active;
    if opt.id is null then perform public.d5_raise('D5422', 'Choose a ' || p_kind || ' this department offers.'); end if;
    if not opt.is_open then perform public.d5_raise('D5409', opt.name || ' is closed to new requests right now.'); end if;
    if public.tier_rank(m.tier) < public.tier_rank(opt.min_tier) then
      perform public.d5_raise('D5403', opt.name || ' requires ' || replace(opt.min_tier::text, '_', ' ') || ' or above.');
    end if;
    if p_kind = 'certification' and exists (select 1 from public.member_certifications
        where membership_id = m.id and name = opt.name and revoked_at is null) then
      perform public.d5_raise('D5409', 'You already hold ' || opt.name || '.');
    end if;
    if p_kind = 'subdivision' and opt.name = any(m.subdivisions) then
      perform public.d5_raise('D5409', 'You are already in ' || opt.name || '.');
    end if;
    if p_kind = 'certification' and j ->> 'meets_requirements' not in ('Yes', 'No') then
      perform public.d5_raise('D5422', 'Answer whether you meet the requirements.');
    end if;
  end if;
  if p_kind = 'leave' then
    begin
      if (j ->> 'end_date')::date < (j ->> 'start_date')::date then
        perform public.d5_raise('D5422', 'Leave must end on or after its start date.');
      end if;
      if (j ->> 'end_date')::date > current_date + 180 then
        perform public.d5_raise('D5422', 'Leave can be requested at most 180 days ahead.');
      end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      perform public.d5_raise('D5422', 'Use valid start and end dates.');
    end;
  end if;
  if p_kind = 'fto_log' then
    if j ->> 'recommendation' not in ('Continue training', 'Ready for release', 'Needs remediation') then
      perform public.d5_raise('D5422', 'Choose a recommendation from the list.');
    end if;
    select * into subj from public.memberships where id = p_subject;
    if subj.id is null or subj.department_key <> p_department or subj.status <> 'active' then
      perform public.d5_raise('D5422', 'Choose the probationary member you rode with.');
    end if;
    if not (subj.is_probationary or subj.tier = 'probationary') then
      perform public.d5_raise('D5422', subj.display_name || ' is not probationary.');
    end if;
    if subj.profile_id = m.profile_id then perform public.d5_raise('D5403', 'You cannot evaluate yourself.'); end if;
    if not (public.tier_rank(m.tier) >= public.tier_rank('supervisor') or exists (
        select 1 from public.member_certifications c where c.membership_id = m.id and c.revoked_at is null and c.name ilike 'FTO%')) then
      perform public.d5_raise('D5403', 'FTO logs are filed by certified FTOs or supervisors.');
    end if;
  end if;
end;
$$;

-- A short list title, so queues are readable without opening every entry.
create or replace function public.submission_title(p_kind text, j jsonb, subj_name text)
returns text language sql immutable as $$
  select left(case p_kind
    when 'incident' then j ->> 'incident_type' || ' · ' || coalesce(j ->> 'location', '')
    when 'use_of_force' then j ->> 'force_type' || ' force'
    when 'fire_incident' then j ->> 'incident_type' || ' · ' || coalesce(j ->> 'location', '')
    when 'patient_care' then coalesce(j ->> 'complaint', 'Patient care') || ' · ' || coalesce(j ->> 'disposition', '')
    when 'warrant' then 'Warrant · ' || coalesce(j ->> 'subject_name', '')
    when 'bolo' then 'BOLO · ' || coalesce(j ->> 'subject', '')
    when 'certification' then 'Certification · ' || coalesce(j ->> 'requested', '')
    when 'subdivision' then 'Subdivision · ' || coalesce(j ->> 'requested', '')
    when 'leave' then 'Leave · ' || coalesce(j ->> 'start_date', '') || ' to ' || coalesce(j ->> 'end_date', '')
    when 'fto_log' then 'FTO log · ' || coalesce(subj_name, '')
  end, 140)
$$;

-- ------------------------------------------------------------ workflows

create or replace function public.save_submission(
  p_id uuid, p_kind text, p_department text, p_details jsonb, p_evidence_url text,
  p_occurred_on date, p_expires_at timestamptz, p_subject uuid, p_submit boolean,
  p_expected_version int default null)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  m public.memberships;
  d public.departments;
  s public.submissions;
  was public.approval_status;
  j jsonb;
  subj_name text;
  ev text := nullif(trim(coalesce(p_evidence_url, '')), '');
begin
  if p_id is not null then
    select * into s from public.submissions where id = p_id for update;
    if s.id is null then perform public.d5_raise('D5404', 'Not found.'); end if;
    if s.profile_id <> p.id then perform public.d5_raise('D5403', 'You can only edit your own submissions.'); end if;
    if s.status not in ('draft', 'returned') then perform public.d5_raise('D5409', 'This was already submitted and can no longer be edited.'); end if;
    if p_expected_version is not null and p_expected_version <> s.version then
      perform public.d5_raise('D5409', 'This entry changed in another window. Reload to see the latest version.');
    end if;
    -- kind and department come from the stored record
    p_kind := s.kind; p_department := s.department_key;
  end if;

  select * into m from public.memberships where profile_id = p.id and department_key = p_department and status = 'active';
  if m.id is null then perform public.d5_raise('D5403', 'You do not hold an active membership in ' || upper(coalesce(p_department, '')) || '.'); end if;
  select * into d from public.departments where key = p_department;
  if d.kind <> 'department' or not public.kind_allowed(p_kind, d.division) then
    perform public.d5_raise('D5422', upper(p_department) || ' does not file this kind of record.');
  end if;
  if ev is not null and ev !~* '^https?://' then perform public.d5_raise('D5422', 'Evidence links must start with http:// or https://.'); end if;

  -- keep only string values, trimmed
  select coalesce(jsonb_object_agg(key, left(trim(value), 4000)) filter (where trim(value) <> ''), '{}')
    into j from jsonb_each_text(coalesce(p_details, '{}'));
  if p_submit then
    perform public.submission_check(p_kind, p_department, m, j, ev, p_occurred_on, p_expires_at, p_subject);
  end if;
  select display_name into subj_name from public.memberships where id = p_subject and department_key = p_department;

  if p_id is null then
    insert into public.submissions (kind, department_key, profile_id, membership_id, snapshot_name, snapshot_rank, snapshot_tier,
      snapshot_callsign, snapshot_badge, title, details, evidence_url, occurred_on, expires_at, subject_membership,
      status, required_tier, submitted_at)
    values (p_kind, p_department, p.id, m.id, m.display_name, m.rank_name, m.tier, m.callsign, m.badge,
      coalesce(nullif(public.submission_title(p_kind, j, subj_name), ''), initcap(replace(p_kind, '_', ' '))),
      j, ev, p_occurred_on, p_expires_at, case when subj_name is not null then p_subject end,
      (case when p_submit then 'submitted' else 'draft' end)::public.approval_status,
      public.required_tier_for(p_kind, p_department, m.tier), case when p_submit then now() end)
    returning * into s;
    was := null;
  else
    was := s.status;
    update public.submissions set
      snapshot_name = m.display_name, snapshot_rank = m.rank_name, snapshot_tier = m.tier,
      snapshot_callsign = m.callsign, snapshot_badge = m.badge,
      title = coalesce(nullif(public.submission_title(p_kind, j, subj_name), ''), s.title),
      details = j, evidence_url = ev, occurred_on = p_occurred_on, expires_at = p_expires_at,
      subject_membership = case when subj_name is not null then p_subject end,
      status = case when p_submit then 'submitted'::public.approval_status else s.status end,
      submitted_at = case when p_submit then now() else s.submitted_at end,
      required_tier = public.required_tier_for(p_kind, p_department, m.tier),
      decision_reason = case when p_submit and s.status = 'returned' then null else s.decision_reason end,
      version = s.version + 1
    where id = s.id returning * into s;
  end if;

  if p_submit then
    insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, actor_tier, action, from_status, to_status)
    values ('submission', s.id, s.ref, s.department_key, p.id, p.id, p.display_name, m.tier,
            case when was = 'returned' then 'resubmitted' else 'submitted' end, was::text, 'submitted');
    perform public.notify(r, 'To review · ' || s.title, s.ref || ' · ' || s.snapshot_name,
      '/hub/reports/' || s.id, 'approval', case when s.kind = 'use_of_force' then 'high' else 'normal' end,
      s.department_key, 'submission', s.id, 'subsub:' || s.id || ':' || s.version)
    from public.reviewers_for(s.department_key, s.required_tier, p.id) r;
  end if;
  perform public.write_audit(p, 'submission.' || case when p_submit then 'submitted' else 'saved' end, 'submission', s.id, s.ref, s.department_key);
  return s;
end;
$$;

create or replace function public.withdraw_submission(p_id uuid, p_reason text default null)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  s public.submissions;
  was public.approval_status;
begin
  select * into s from public.submissions where id = p_id for update;
  if s.id is null then perform public.d5_raise('D5404', 'Not found.'); end if;
  if s.profile_id <> p.id then perform public.d5_raise('D5403', 'You can only withdraw your own submissions.'); end if;
  if s.status not in ('draft', 'submitted', 'under_review', 'returned') then
    perform public.d5_raise('D5409', 'A decided submission cannot be withdrawn.');
  end if;
  was := s.status;
  update public.submissions set status = 'withdrawn', decision_reason = nullif(trim(coalesce(p_reason, '')), ''), version = version + 1
  where id = s.id returning * into s;
  insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, action, from_status, to_status, reason)
  values ('submission', s.id, s.ref, s.department_key, p.id, p.id, p.display_name, 'withdrawn', was::text, 'withdrawn', p_reason);
  perform public.write_audit(p, 'submission.withdrawn', 'submission', s.id, s.ref, s.department_key);
  return s;
end;
$$;

-- Approve, deny, return, escalate or claim a submission; 'archive' clears an approved
-- warrant or BOLO (served, found, or no longer needed).
create or replace function public.decide_submission(p_id uuid, p_action text, p_reason text default null)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  s public.submissions;
  m public.memberships;
  was public.approval_status;
  reviewer_tier public.tier;
begin
  select * into s from public.submissions where id = p_id for update;
  if s.id is null then perform public.d5_raise('D5404', 'Not found.'); end if;
  if s.profile_id = p.id then perform public.d5_raise('D5403', 'You cannot review your own submission. Another reviewer must decide it.'); end if;

  if p_action = 'archive' then
    if s.kind not in ('warrant', 'bolo') or s.status <> 'approved' then
      perform public.d5_raise('D5409', 'Only an active warrant or BOLO can be cleared.');
    end if;
    if not public.can_supervise(s.department_key) then perform public.d5_raise('D5403', 'A supervisor must clear it.'); end if;
  else
    if not public.can_decide(s.department_key, s.required_tier) then
      perform public.d5_raise('D5403', 'This needs a ' || replace(s.required_tier::text, '_', ' ') || ' or above in ' || upper(s.department_key) || ', or division command.');
    end if;
    if s.status not in ('submitted', 'under_review') then
      perform public.d5_raise('D5409', 'This was already ' || s.status || ' by ' || coalesce(s.decided_by_name, 'another reviewer') || '.');
    end if;
  end if;
  if p_action in ('deny', 'return') and length(trim(coalesce(p_reason, ''))) < 5 then
    perform public.d5_raise('D5422', case when p_action = 'deny' then 'A denial needs a reason the member can act on.' else 'Say what needs correcting.' end);
  end if;

  was := s.status;
  reviewer_tier := coalesce(public.my_tier(s.department_key), case when public.oversees(s.department_key) then 'dps'::public.tier end);
  if p_action = 'approve' then
    update public.submissions set status = 'approved', decided_at = now(), decided_by = p.id, decided_by_name = p.display_name,
      decision_reason = nullif(trim(coalesce(p_reason, '')), ''), version = version + 1 where id = s.id returning * into s;
    select * into m from public.memberships where id = s.membership_id for update;
    if s.kind = 'certification' then
      insert into public.member_certifications (membership_id, department_key, name, granted_by, granted_by_name, source_submission)
      values (m.id, m.department_key, s.details ->> 'requested', p.id, p.display_name, s.id)
      on conflict do nothing;
    elsif s.kind = 'subdivision' and not (s.details ->> 'requested' = any(m.subdivisions)) then
      update public.memberships set subdivisions = array_append(subdivisions, s.details ->> 'requested') where id = m.id;
    elsif s.kind = 'leave' then
      update public.memberships set leave_until = greatest(coalesce(leave_until, (s.details ->> 'end_date')::date), (s.details ->> 'end_date')::date)
      where id = m.id;
    end if;
    if s.kind in ('certification', 'subdivision', 'leave') then
      insert into public.personnel_records (membership_id, department_key, category, title, after_value, created_by, created_by_name)
      values (m.id, m.department_key, case s.kind when 'leave' then 'leave' when 'certification' then 'certification' else 'roster_change' end,
              s.title || ' approved', s.details, p.id, p.display_name);
    end if;
  elsif p_action = 'deny' then
    update public.submissions set status = 'denied', decided_at = now(), decided_by = p.id, decided_by_name = p.display_name,
      decision_reason = p_reason, version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'return' then
    update public.submissions set status = 'returned', decided_at = now(), decided_by = p.id, decided_by_name = p.display_name,
      decision_reason = p_reason, version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'escalate' then
    if s.required_tier = 'dps' then perform public.d5_raise('D5409', 'This is already with division command.'); end if;
    update public.submissions set status = 'under_review', required_tier = 'dps', assigned_to = null,
      decision_reason = nullif(trim(coalesce(p_reason, '')), ''), version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'claim' then
    update public.submissions set status = 'under_review', assigned_to = p.id, version = version + 1 where id = s.id returning * into s;
  elsif p_action = 'archive' then
    update public.submissions set status = 'archived', decision_reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), decision_reason),
      version = version + 1 where id = s.id returning * into s;
  else
    perform public.d5_raise('D5422', 'Unknown action.');
  end if;

  insert into public.approval_actions (record_type, record_id, record_ref, department_key, submitter_id, actor_id, actor_name, actor_tier, action, from_status, to_status, reason)
  values ('submission', s.id, s.ref, s.department_key, s.profile_id, p.id, p.display_name, reviewer_tier,
          case p_action when 'approve' then 'approved' when 'deny' then 'denied' when 'return' then 'returned'
                        when 'escalate' then 'escalated' when 'archive' then 'archived' else 'claimed' end,
          was::text, s.status::text, p_reason);

  if p_action in ('approve', 'deny', 'return', 'archive') then
    perform public.notify(s.profile_id,
      case p_action when 'approve' then 'Approved' when 'deny' then 'Denied' when 'archive' then 'Cleared' else 'Returned for correction' end || ' · ' || s.title,
      coalesce(p_reason, s.ref), '/hub/reports/' || s.id, 'approval', case when p_action = 'approve' then 'normal' else 'high' end,
      s.department_key, 'submission', s.id, null);
  elsif p_action = 'escalate' then
    perform public.notify(r, 'Escalated · ' || s.title, coalesce(p_reason, s.snapshot_name), '/hub/reports/' || s.id,
      'approval', 'high', s.department_key, 'submission', s.id, 'subesc:' || s.id)
    from public.reviewers_for(s.department_key, 'dps', s.profile_id) r;
  end if;
  perform public.write_audit(p, 'submission.' || p_action, 'submission', s.id, s.ref, s.department_key,
    jsonb_build_object('status', was), jsonb_build_object('status', s.status, 'reason', p_reason));
  return s;
end;
$$;

-- Command can revoke a certification, with a reason recorded in personnel history.
create or replace function public.revoke_certification(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  c public.member_certifications;
begin
  select * into c from public.member_certifications where id = p_id and revoked_at is null for update;
  if c.id is null then perform public.d5_raise('D5404', 'Certification not found.'); end if;
  if not public.can_manage_roster(c.department_key) then perform public.d5_raise('D5403', 'High command authority is required.'); end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then perform public.d5_raise('D5422', 'Give a short reason.'); end if;
  update public.member_certifications set revoked_at = now() where id = c.id;
  insert into public.personnel_records (membership_id, department_key, category, title, detail, created_by, created_by_name)
  values (c.membership_id, c.department_key, 'certification', c.name || ' certification revoked', p_reason, p.id, p.display_name);
  perform public.write_audit(p, 'certification.revoked', 'member_certification', c.id, c.name, c.department_key);
end;
$$;

-- Top members this week by clocked time, approved and pending (denied and returned excluded).
create or replace function public.weekly_leaderboard(p_department text, p_limit int default 10)
returns table (display_name text, callsign text, rank_name text, minutes int)
language plpgsql stable security definer set search_path = public as $$
declare d public.departments;
begin
  select * into d from public.departments where key = p_department;
  if d.key is null then perform public.d5_raise('D5404', 'Department not found.'); end if;
  if not public.can_read_department(p_department) then perform public.d5_raise('D5403', 'Members only.'); end if;
  return query
    select m.display_name, m.callsign, m.rank_name, sum(s.duration_minutes)::int
    from public.shift_logs s join public.memberships m on m.id = s.membership_id
    where s.department_key = p_department and s.status in ('submitted', 'under_review', 'approved')
      and s.week_start = public.week_start_for(now(), d.timezone, d.week_starts_on)
    group by m.id, m.display_name, m.callsign, m.rank_name
    order by 4 desc, 1
    limit least(greatest(coalesce(p_limit, 10), 1), 50);
end;
$$;

-- -------------------------------------------------------------- admin

create or replace function public.admin_save_option(
  p_id uuid, p_department text, p_kind text, p_name text, p_description text,
  p_min_tier public.tier, p_open boolean, p_sort int, p_active boolean default true)
returns public.department_options language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  o public.department_options;
begin
  if not public.is_admin() then perform public.d5_raise('D5403', 'Administrator access is required.'); end if;
  if p_id is null then
    insert into public.department_options (department_key, kind, name, description, min_tier, is_open, sort_order, active)
    values (p_department, p_kind, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_min_tier, 'probationary'),
            coalesce(p_open, true), coalesce(p_sort, 0), coalesce(p_active, true))
    returning * into o;
  else
    update public.department_options set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), ''),
      min_tier = coalesce(p_min_tier, min_tier), is_open = coalesce(p_open, is_open), sort_order = coalesce(p_sort, sort_order),
      active = coalesce(p_active, active)
    where id = p_id returning * into o;
    if o.id is null then perform public.d5_raise('D5404', 'Option not found.'); end if;
  end if;
  perform public.write_audit(p, 'option.saved', 'department_option', o.id, o.name, o.department_key);
  return o;
exception when unique_violation then
  perform public.d5_raise('D5409', 'That name is already listed for this department.');
end;
$$;

-- ----------------------------------------------------------- row security

alter table public.department_options enable row level security;
alter table public.member_certifications enable row level security;
alter table public.submissions enable row level security;

create policy options_read on public.department_options for select using (true);
-- Training records are general roster information, like rank and callsign.
create policy certifications_read on public.member_certifications for select using (public.is_active_member() or public.is_admin());

create policy submissions_own on public.submissions for select using (profile_id = auth.uid());
create policy submissions_reviewers on public.submissions for select using (
  status <> 'draft' and public.can_supervise(department_key)
);
-- Active warrants and BOLOs are shared with every active member of the division.
create policy submissions_active_alerts on public.submissions for select using (
  kind in ('warrant', 'bolo') and status = 'approved' and expires_at > now()
  and public.in_division(public.division_of(department_key))
);
-- A trainee reads decided FTO logs about themselves.
create policy submissions_fto_subject on public.submissions for select using (
  kind = 'fto_log' and status = 'approved' and exists (
    select 1 from public.memberships m where m.id = submissions.subject_membership and m.profile_id = auth.uid())
);

grant select on public.department_options, public.member_certifications, public.submissions to anon, authenticated;
revoke insert, update, delete, truncate on public.department_options, public.member_certifications, public.submissions from anon, authenticated;

revoke execute on function public.kind_allowed(text, text), public.in_division(text), public.d5_text(jsonb, text),
  public.submission_check(text, text, public.memberships, jsonb, text, date, timestamptz, uuid),
  public.submission_title(text, jsonb, text), public.save_submission(uuid, text, text, jsonb, text, date, timestamptz, uuid, boolean, int),
  public.withdraw_submission(uuid, text), public.decide_submission(uuid, text, text), public.revoke_certification(uuid, text),
  public.weekly_leaderboard(text, int), public.admin_save_option(uuid, text, text, text, text, public.tier, boolean, int, boolean)
  from public, anon;
grant execute on function public.save_submission(uuid, text, text, jsonb, text, date, timestamptz, uuid, boolean, int),
  public.withdraw_submission(uuid, text), public.decide_submission(uuid, text, text), public.revoke_certification(uuid, text),
  public.weekly_leaderboard(text, int), public.admin_save_option(uuid, text, text, text, text, public.tier, boolean, int, boolean),
  public.kind_allowed(text, text), public.submission_title(text, jsonb, text), public.d5_text(jsonb, text)
  to authenticated;
-- policy helper: anonymous policy checks must be able to evaluate it
grant execute on function public.in_division(text) to anon, authenticated;
-- internal: only called from save_submission
revoke execute on function public.submission_check(text, text, public.memberships, jsonb, text, date, timestamptz, uuid) from authenticated;

-- ---------------------------------------------------------- starting options
-- Certifications and subdivisions named on the SAHP portal and in the BCSO and Fire/EMS
-- Discord servers. Administrators can rename, close or add to these.
-- Existing databases only; fresh installs get the same rows from seed.sql.
insert into public.department_options (department_key, kind, name, sort_order)
select v.* from (values
  ('sahp', 'certification', 'High speed', 10), ('sahp', 'certification', 'SQAS', 20), ('sahp', 'certification', 'K9', 30),
  ('sahp', 'certification', 'First Aid', 40), ('sahp', 'certification', 'Rifle', 50), ('sahp', 'certification', 'EVOC', 60),
  ('sahp', 'certification', 'Motor Bike', 70), ('sahp', 'certification', 'Marine', 80), ('sahp', 'certification', 'Air 1', 90),
  ('sahp', 'subdivision', 'SWAT', 10), ('sahp', 'subdivision', 'CID', 20),
  ('bcso', 'certification', 'Firearm / Rifle', 10), ('bcso', 'certification', 'EVOC', 20), ('bcso', 'certification', 'First Aid', 30),
  ('bcso', 'certification', 'HSU', 40), ('bcso', 'certification', 'Air', 50), ('bcso', 'certification', 'FTO', 60),
  ('bcso', 'subdivision', 'K-9', 10), ('bcso', 'subdivision', 'Air & Coastal', 20), ('bcso', 'subdivision', 'Investigations', 30),
  ('safd', 'certification', 'EVOC', 10), ('saems', 'certification', 'EVOC', 10)
) v(department_key, kind, name, sort_order)
where exists (select 1 from public.departments d where d.key = v.department_key)
on conflict (department_key, kind, name) do nothing;
