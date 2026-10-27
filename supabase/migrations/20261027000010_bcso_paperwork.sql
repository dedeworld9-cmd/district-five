-- BCSO paperwork from the LE Discord: office requests, roster update requests, vehicle and
-- firearm registrations, CAD reports, evidence room log entries, confiscation requests and
-- suggestions, plus the department agreement sign-off. Fields follow the formats posted in the BCSO channels. Open to every LEO department.

alter table public.submissions drop constraint if exists submissions_kind_check;
alter table public.submissions add constraint submissions_kind_check check (kind in (
  'incident', 'use_of_force', 'fire_incident', 'patient_care',
  'warrant', 'bolo', 'certification', 'subdivision', 'leave', 'fto_log',
  'arrest', 'citation', 'ois',
  'office_request', 'roster_update', 'vehicle_reg', 'firearm_reg', 'cad_report', 'evidence_log',
  'confiscation', 'suggestion', 'agreement'));

-- Roster updates are approved by Lt. Colonel and above (high command).
insert into public.approval_routes (record_type, department_key, submitter_tier, required_tier) values
  ('roster_update', null, 'probationary', 'high_command'),
  ('roster_update', null, 'patrol', 'high_command'),
  ('roster_update', null, 'supervisor', 'high_command')
on conflict do nothing;

create or replace function public.kind_allowed(p_kind text, p_division text)
returns boolean language sql immutable as $$
  select case p_division
    when 'leo' then p_kind in ('incident', 'arrest', 'citation', 'use_of_force', 'ois', 'warrant', 'bolo',
                               'certification', 'subdivision', 'leave', 'fto_log',
                               'office_request', 'roster_update', 'vehicle_reg', 'firearm_reg', 'cad_report',
                               'evidence_log', 'confiscation', 'suggestion', 'agreement')
    when 'fire_ems' then p_kind in ('fire_incident', 'patient_care', 'certification', 'subdivision', 'leave', 'fto_log')
    when 'dispatch' then p_kind in ('certification', 'leave')
    else false
  end
$$;

-- Guarded so the file can be run again safely.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'submission_check_v2') then
    alter function public.submission_check(text, text, public.memberships, jsonb, text, date, timestamptz, uuid)
      rename to submission_check_v2;
  end if;
end $$;

create or replace function public.submission_check(
  p_kind text, p_department text, m public.memberships, j jsonb, p_evidence text,
  p_occurred date, p_expires timestamptz, p_subject uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  need text[];
  k text;
  label jsonb := '{"description":"description of the request","priority":"priority","character_name":"character name",
    "update_type":"update type","reason":"reason","make":"make","model":"model","plate":"license plate",
    "dl_on_cad":"whether your license is on CIV CAD","fl_on_cad":"whether your firearms license is on CIV CAD",
    "firearm_type":"firearm type","dept_certified":"whether you are firearm certified","cad_no":"CAD record number",
    "call_type":"call type","location":"location","summary":"summary","item":"item","case_no":"case or report number",
    "storage":"where it is stored","subject_name":"subject''s name","items":"items confiscated","topic":"topic",
    "suggestion":"suggestion","agrees":"your agreement","signature":"your initials"}';
begin
  if p_kind not in ('office_request', 'roster_update', 'vehicle_reg', 'firearm_reg', 'cad_report',
                    'evidence_log', 'confiscation', 'suggestion', 'agreement') then
    perform public.submission_check_v2(p_kind, p_department, m, j, p_evidence, p_occurred, p_expires, p_subject);
    return;
  end if;
  need := case p_kind
    when 'office_request' then array['description', 'priority']
    when 'roster_update' then array['character_name', 'update_type', 'reason']
    when 'vehicle_reg' then array['dl_on_cad', 'make', 'model', 'plate']
    when 'firearm_reg' then array['fl_on_cad', 'dept_certified', 'make', 'model', 'firearm_type']
    when 'cad_report' then array['cad_no', 'call_type', 'location', 'summary']
    when 'evidence_log' then array['item', 'case_no', 'storage']
    when 'confiscation' then array['subject_name', 'items', 'reason']
    when 'suggestion' then array['topic', 'suggestion']
    when 'agreement' then array['character_name', 'agrees', 'signature']
  end;
  foreach k in array need loop
    if public.d5_text(j, k) is null then
      perform public.d5_raise('D5422', 'Add the ' || coalesce(label ->> k, replace(k, '_', ' ')) || '.');
    end if;
  end loop;
  if p_occurred > current_date + 1 then perform public.d5_raise('D5422', 'The date cannot be in the future.'); end if;
  if p_kind in ('cad_report', 'evidence_log', 'confiscation') and p_occurred is null then
    perform public.d5_raise('D5422', 'Add the date.');
  end if;
  if p_kind = 'office_request' and j ->> 'priority' not in ('Low', 'Normal', 'High', 'Urgent') then
    perform public.d5_raise('D5422', 'Choose a priority from the list.');
  end if;
  if p_kind = 'roster_update' and j ->> 'update_type' not in ('New addition', 'Rank change', 'Removal', 'LOA') then
    perform public.d5_raise('D5422', 'Choose an update type from the list.');
  end if;
  if p_kind = 'agreement' and j ->> 'agrees' <> 'I agree' then
    perform public.d5_raise('D5422', 'You must agree to sign the agreement.');
  end if;
  if p_kind = 'firearm_reg' and j ->> 'firearm_type' not in ('Handgun', 'Longarm - Rifle', 'Longarm - Shotgun') then
    perform public.d5_raise('D5422', 'Choose a firearm type from the list.');
  end if;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'submission_title_v2') then
    alter function public.submission_title(text, jsonb, text) rename to submission_title_v2;
  end if;
end $$;

create or replace function public.submission_title(p_kind text, j jsonb, subj_name text)
returns text language sql immutable as $$
  select case p_kind
    when 'office_request' then left('Office request · ' || coalesce(j ->> 'priority', '') || ' · ' || coalesce(j ->> 'description', ''), 140)
    when 'roster_update' then left('Roster update · ' || coalesce(j ->> 'update_type', '') || ' · ' || coalesce(j ->> 'character_name', ''), 140)
    when 'vehicle_reg' then left('Vehicle registration · ' || coalesce(j ->> 'make', '') || ' ' || coalesce(j ->> 'model', '') || ' · ' || coalesce(j ->> 'plate', ''), 140)
    when 'firearm_reg' then left('Firearm registration · ' || coalesce(j ->> 'make', '') || ' ' || coalesce(j ->> 'model', ''), 140)
    when 'cad_report' then left('CAD report · ' || coalesce(j ->> 'cad_no', '') || ' · ' || coalesce(j ->> 'call_type', ''), 140)
    when 'evidence_log' then left('Evidence · ' || coalesce(j ->> 'case_no', '') || ' · ' || coalesce(j ->> 'item', ''), 140)
    when 'confiscation' then left('Confiscation · ' || coalesce(j ->> 'subject_name', ''), 140)
    when 'agreement' then left('Agreement · ' || coalesce(j ->> 'character_name', ''), 140)
    when 'suggestion' then left('Suggestion · ' || coalesce(j ->> 'topic', ''), 140)
    else public.submission_title_v2(p_kind, j, subj_name)
  end
$$;
