-- Arrest reports, citations and officer-involved shooting (OIS) reports for law enforcement.
-- Arrest and citation fields follow the formats members already post in the State Judiciary
-- server; the hub keeps the department's copy and does not replace the Judiciary filing or CAD.

alter table public.submissions drop constraint if exists submissions_kind_check;
alter table public.submissions add constraint submissions_kind_check check (kind in (
  'incident', 'use_of_force', 'fire_incident', 'patient_care',
  'warrant', 'bolo', 'certification', 'subdivision', 'leave', 'fto_log',
  'arrest', 'citation', 'ois'));

-- OIS reports go straight to department heads, like use of force.
insert into public.approval_routes (record_type, department_key, submitter_tier, required_tier) values
  ('ois', null, 'probationary', 'department_head'),
  ('ois', null, 'patrol', 'department_head'),
  ('ois', null, 'supervisor', 'department_head'),
  ('ois', null, 'high_command', 'department_head')
on conflict do nothing;

create or replace function public.kind_allowed(p_kind text, p_division text)
returns boolean language sql immutable as $$
  select case p_division
    when 'leo' then p_kind in ('incident', 'arrest', 'citation', 'use_of_force', 'ois', 'warrant', 'bolo',
                               'certification', 'subdivision', 'leave', 'fto_log')
    when 'fire_ems' then p_kind in ('fire_incident', 'patient_care', 'certification', 'subdivision', 'leave', 'fto_log')
    when 'dispatch' then p_kind in ('certification', 'leave')
    else false
  end
$$;

-- The earlier checks stay as they are; the new kinds are checked here first.
-- Guarded so the file can be run again safely.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'submission_check_v1') then
    alter function public.submission_check(text, text, public.memberships, jsonb, text, date, timestamptz, uuid)
      rename to submission_check_v1;
  end if;
end $$;

create or replace function public.submission_check(
  p_kind text, p_department text, m public.memberships, j jsonb, p_evidence text,
  p_occurred date, p_expires timestamptz, p_subject uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  need text[];
  k text;
  label jsonb := '{"suspect_name":"suspect''s character name","charges":"charges","bail_status":"bail status",
    "violation":"violation","fine":"fine amount","fine_status":"whether the fine is paid","location":"location",
    "suspect_status":"suspect''s condition","scene":"scene description"}';
begin
  if p_kind not in ('arrest', 'citation', 'ois') then
    perform public.submission_check_v1(p_kind, p_department, m, j, p_evidence, p_occurred, p_expires, p_subject);
    return;
  end if;
  need := case p_kind
    when 'arrest' then array['suspect_name', 'charges', 'bail_status']
    when 'citation' then array['suspect_name', 'violation', 'fine', 'fine_status']
    when 'ois' then array['location', 'suspect_status', 'scene']
  end;
  foreach k in array need loop
    if public.d5_text(j, k) is null then
      perform public.d5_raise('D5422', 'Add the ' || coalesce(label ->> k, replace(k, '_', ' ')) || '.');
    end if;
  end loop;
  if p_occurred is null then perform public.d5_raise('D5422', 'Add the date it happened.'); end if;
  if p_occurred > current_date + 1 then perform public.d5_raise('D5422', 'The date cannot be in the future.'); end if;
  if p_kind = 'arrest' and j ->> 'bail_status' not in ('Paid', 'Unpaid', 'No bail', 'Held in custody') then
    perform public.d5_raise('D5422', 'Choose a bail status from the list.');
  end if;
  if p_kind = 'citation' and j ->> 'fine_status' not in ('Paid', 'Unpaid') then
    perform public.d5_raise('D5422', 'Choose whether the fine is paid.');
  end if;
  if p_kind = 'ois' then
    if j ->> 'suspect_status' not in ('Uninjured', 'Injured', 'Deceased', 'Fled', 'Unknown') then
      perform public.d5_raise('D5422', 'Choose the suspect''s condition from the list.');
    end if;
    if p_evidence is null then perform public.d5_raise('D5422', 'OIS reports need a video evidence link.'); end if;
  end if;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'submission_title_v1') then
    alter function public.submission_title(text, jsonb, text) rename to submission_title_v1;
  end if;
end $$;

create or replace function public.submission_title(p_kind text, j jsonb, subj_name text)
returns text language sql immutable as $$
  select case p_kind
    when 'arrest' then left('Arrest · ' || coalesce(j ->> 'suspect_name', ''), 140)
    when 'citation' then left('Citation · ' || coalesce(j ->> 'suspect_name', '') || coalesce(' · ' || nullif(j ->> 'violation', ''), ''), 140)
    when 'ois' then left('OIS · ' || coalesce(j ->> 'location', ''), 140)
    else public.submission_title_v1(p_kind, j, subj_name)
  end
$$;
