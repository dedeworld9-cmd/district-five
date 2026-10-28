-- DPS patrol: members of a division command (DPS, Fire/EMS Administration) can file
-- the reports and requests of their own division under that command. Routing sends them
-- to division command, and nobody can approve their own entry.

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
  if not public.kind_allowed(p_kind, d.division) then
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
