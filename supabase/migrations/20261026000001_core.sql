-- District Five Law Enforcement Hub: core schema (Stage 1)
-- Roleplay community hub. All operational records are fictional.
--
-- Access model
--   * Every table has row-level security. Browser clients never write tables
--     directly; consequential changes go through the SECURITY DEFINER
--     functions in 20261026000002_functions.sql, which check authority.
--   * "Active membership" is the unit of access. Suspending or removing a
--     membership revokes access without deleting history.
--   * Technical administration (profiles.is_admin) is separate from the
--     authority to read confidential personnel records.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------- enums

create type public.tier as enum (
  'probationary', 'patrol', 'supervisor', 'high_command', 'department_head', 'dps'
);

create type public.membership_status as enum ('pending', 'active', 'suspended', 'removed', 'denied');

create type public.duty_status as enum ('off_duty', 'on_duty', 'unavailable');

create type public.approval_status as enum (
  'draft', 'submitted', 'under_review', 'returned', 'approved', 'denied', 'withdrawn', 'archived'
);

create or replace function public.tier_rank(t public.tier)
returns int language sql immutable as $$
  select case t
    when 'probationary' then 1
    when 'patrol' then 2
    when 'supervisor' then 3
    when 'high_command' then 4
    when 'department_head' then 5
    when 'dps' then 6
  end
$$;

-- ---------------------------------------------------------- configuration

create table public.departments (
  key text primary key check (key ~ '^[a-z0-9_]{2,12}$'),
  name text not null,
  short_name text not null,
  kind text not null default 'department' check (kind in ('department', 'oversight')),
  tagline text,
  public_blurb text,
  accent text not null default '#8a94a6',
  quota_minutes int not null default 240 check (quota_minutes between 0 and 10080),
  week_starts_on int not null default 1 check (week_starts_on between 0 and 6),
  timezone text not null default 'America/New_York',
  bodycam_required boolean not null default false,
  bodycam_policy_text text,
  bodycam_policy_url text,
  sort_order int not null default 0,
  active boolean not null default true
);

-- Department rank ladders mapped to shared tiers. Values are configurable;
-- seed rows are marked is_sample until an administrator confirms them.
create table public.ranks (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references public.departments(key),
  name text not null,
  abbreviation text,
  tier public.tier not null,
  sort_order int not null default 0,
  is_sample boolean not null default true,
  active boolean not null default true,
  unique (department_key, name)
);

-- Which tier must review a record, by record type, department and submitter tier.
-- department_key null = district-wide default.
create table public.approval_routes (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  department_key text references public.departments(key),
  submitter_tier public.tier not null,
  required_tier public.tier not null,
  unique nulls not distinct (record_type, department_key, submitter_tier)
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------ people and roster

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  discord_id text,
  discord_username text,
  psn_id text,
  avatar_url text,
  active_department text references public.departments(key),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.ref_membership;
create sequence public.ref_shift;
create sequence public.ref_announcement;
create sequence public.ref_policy;
create sequence public.ref_personnel;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('D5-MB-' || lpad(nextval('public.ref_membership')::text, 4, '0')),
  profile_id uuid references public.profiles(id),
  display_name text not null,
  department_key text not null references public.departments(key),
  rank_id uuid references public.ranks(id),
  rank_name text,
  tier public.tier not null default 'probationary',
  callsign text,
  badge text,
  status public.membership_status not null default 'pending',
  is_probationary boolean not null default true,
  probation_phase text,
  join_date date,
  supervisor_id uuid references public.memberships(id),
  training_officer_id uuid references public.memberships(id),
  subdivisions text[] not null default '{}',
  duty_status public.duty_status not null default 'off_duty',
  duty_changed_at timestamptz,
  leave_until date,
  can_view_personnel boolean not null default false,
  request_note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One membership per person per department (pending/active/suspended).
create unique index memberships_one_per_department
  on public.memberships (profile_id, department_key)
  where profile_id is not null and status in ('pending', 'active', 'suspended');
create index memberships_department_status on public.memberships (department_key, status);

-- Confidential personnel history. Readable only by explicitly authorized command.
create table public.personnel_records (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('D5-PR-' || lpad(nextval('public.ref_personnel')::text, 4, '0')),
  membership_id uuid not null references public.memberships(id),
  department_key text not null references public.departments(key),
  category text not null check (category in (
    'promotion', 'demotion', 'rank_change', 'status_change', 'transfer', 'commendation',
    'disciplinary', 'note', 'certification', 'leave', 'roster_change')),
  title text not null,
  detail text,
  before_value jsonb,
  after_value jsonb,
  effective_date date not null default current_date,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ shift logs

create table public.shift_logs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('D5-SH-' || lpad(nextval('public.ref_shift')::text, 5, '0')),
  profile_id uuid not null references public.profiles(id),
  membership_id uuid not null references public.memberships(id),
  department_key text not null references public.departments(key),
  -- identity snapshot at submission; later promotions never rewrite it
  snapshot_name text not null,
  snapshot_rank text,
  snapshot_tier public.tier not null,
  snapshot_callsign text,
  snapshot_badge text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  break_minutes int not null default 0 check (break_minutes between 0 and 480),
  duration_minutes int not null check (duration_minutes between 1 and 960),
  week_start date not null,
  activity_type text not null check (activity_type in (
    'patrol', 'traffic', 'training', 'administrative', 'special_assignment', 'supervision')),
  summary text not null default '' check (length(summary) <= 4000),
  cad_reference text check (length(cad_reference) <= 80),
  recording_url text check (recording_url is null or recording_url ~* '^https?://'),
  bodycam_status text not null default 'not_required' check (bodycam_status in (
    'recorded', 'unavailable', 'not_applicable', 'not_required')),
  bodycam_explanation text,
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
  updated_at timestamptz not null default now(),
  check (ended_at > started_at)
);

create index shift_logs_profile_week on public.shift_logs (profile_id, week_start);
create index shift_logs_department_status on public.shift_logs (department_key, status, submitted_at);

-- Time a person logs can never overlap itself, in any department.
-- Withdrawn, denied and archived entries release their time.
alter table public.shift_logs add constraint shift_logs_no_overlap
  exclude using gist (
    profile_id with =,
    tstzrange(started_at, ended_at, '[)') with &&
  ) where (status not in ('withdrawn', 'denied', 'archived'));

-- Generic approval timeline used by every request type.
create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  record_ref text,
  department_key text references public.departments(key),
  submitter_id uuid references public.profiles(id),
  actor_id uuid references public.profiles(id),
  actor_name text,
  actor_tier public.tier,
  action text not null check (action in (
    'created', 'submitted', 'resubmitted', 'claimed', 'assigned', 'approved', 'denied',
    'returned', 'escalated', 'withdrawn', 'commented', 'archived')),
  from_status text,
  to_status text,
  reason text,
  created_at timestamptz not null default now()
);
create index approval_actions_record on public.approval_actions (record_type, record_id, created_at);

-- ------------------------------------------------- communication & policy

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('D5-AN-' || lpad(nextval('public.ref_announcement')::text, 4, '0')),
  title text not null check (length(title) between 3 and 160),
  body text not null default '',
  scope text not null default 'district' check (scope in ('district', 'department')),
  department_key text references public.departments(key),
  audience_min_tier public.tier not null default 'probationary',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Public visibility is a separate, explicit approval.
  is_public boolean not null default false,
  public_approved_by uuid references public.profiles(id),
  public_approved_at timestamptz,
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  pinned boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles(id),
  author_name text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'district' or department_key is not null)
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('D5-POL-' || lpad(nextval('public.ref_policy')::text, 3, '0')),
  title text not null,
  category text not null default 'sop',
  department_key text references public.departments(key),
  version text not null default '1.0',
  summary text,
  body text,
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'archived')),
  requires_acknowledgment boolean not null default false,
  effective_date date,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policy_acknowledgments (
  policy_id uuid not null references public.policies(id),
  profile_id uuid not null references public.profiles(id),
  policy_version text not null,
  acknowledged_at timestamptz not null default now(),
  primary key (policy_id, profile_id, policy_version)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('normal', 'high', 'critical')),
  department_key text,
  related_type text,
  related_id uuid,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedupe on public.notifications (profile_id, dedupe_key) where dedupe_key is not null;
create index notifications_unread on public.notifications (profile_id, created_at desc) where read_at is null;

-- Append-only audit trail.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_ref text,
  department_key text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger memberships_touch before update on public.memberships for each row execute function public.touch_updated_at();
create trigger shift_logs_touch before update on public.shift_logs for each row execute function public.touch_updated_at();
create trigger announcements_touch before update on public.announcements for each row execute function public.touch_updated_at();
create trigger policies_touch before update on public.policies for each row execute function public.touch_updated_at();

-- New sign-ins get a profile. Discord metadata fills the display name.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, display_name, discord_id, discord_username, avatar_url)
  values (
    new.id,
    coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', split_part(coalesce(new.email, 'member'), '@', 1)),
    coalesce(meta->>'provider_id', meta->>'sub'),
    meta->>'name',
    meta->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
