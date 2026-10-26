-- Access helpers and row-level security.
-- Helpers are SECURITY DEFINER so policies can consult memberships without
-- recursing through memberships' own policies.

create or replace function public.me()
returns uuid language sql stable as $$ select auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Highest tier the caller holds in a department through an ACTIVE membership.
create or replace function public.my_tier(dept text)
returns public.tier language sql stable security definer set search_path = public as $$
  select m.tier from public.memberships m
  where m.profile_id = auth.uid() and m.department_key = dept and m.status = 'active'
  order by public.tier_rank(m.tier) desc limit 1
$$;

create or replace function public.has_tier(dept text, min_tier public.tier)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.tier_rank(public.my_tier(dept)) >= public.tier_rank(min_tier), false)
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where profile_id = auth.uid() and status = 'active')
$$;

create or replace function public.is_member_of(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where profile_id = auth.uid() and department_key = dept and status = 'active')
$$;

-- DPS oversight: an active membership in an oversight department.
create or replace function public.is_dps()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m join public.departments d on d.key = m.department_key
                 where m.profile_id = auth.uid() and m.status = 'active' and d.kind = 'oversight')
$$;

-- Routine operational records: own department, or DPS.
create or replace function public.can_read_department(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member_of(dept) or public.is_dps()
$$;

-- Supervisory read of a department's personal submissions.
create or replace function public.can_supervise(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_tier(dept, 'supervisor') or public.is_dps()
$$;

-- Confidential personnel records. Technical admin does NOT imply this.
create or replace function public.can_view_personnel(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.departments d on d.key = m.department_key
    where m.profile_id = auth.uid() and m.status = 'active'
      and ((m.department_key = dept and (public.tier_rank(m.tier) >= public.tier_rank('department_head') or m.can_view_personnel))
        or (d.kind = 'oversight' and m.can_view_personnel))
  )
$$;

-- Roster managers: department heads of that department, DPS command, or technical admin.
create or replace function public.can_manage_roster(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_tier(dept, 'high_command') or public.is_dps() or public.is_admin()
$$;

-- ------------------------------------------------------------------ RLS

alter table public.departments enable row level security;
alter table public.ranks enable row level security;
alter table public.approval_routes enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.personnel_records enable row level security;
alter table public.shift_logs enable row level security;
alter table public.approval_actions enable row level security;
alter table public.announcements enable row level security;
alter table public.policies enable row level security;
alter table public.policy_acknowledgments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Configuration: readable by everyone (public site shows departments); written via functions only.
create policy departments_read on public.departments for select using (active or public.is_admin());
create policy ranks_read on public.ranks for select using (true);
create policy routes_read on public.approval_routes for select to authenticated using (true);
create policy settings_read on public.app_settings for select to authenticated using (true);

-- Profiles: yourself; people who share an active department with you see names only via the
-- roster functions. Contact identifiers (PSN/Discord) are visible to supervisors of a shared
-- department, DPS and admins.
create policy profiles_self on public.profiles for select using (id = auth.uid());
create policy profiles_supervised on public.profiles for select using (
  public.is_dps() or public.is_admin() or exists (
    select 1 from public.memberships m
    where m.profile_id = profiles.id and m.status in ('active', 'pending', 'suspended')
      and public.can_supervise(m.department_key)
  )
);

-- Memberships: general roster information is visible to any active member of either
-- department; your own memberships (including pending) are always visible.
create policy memberships_own on public.memberships for select using (profile_id = auth.uid());
create policy memberships_roster on public.memberships for select using (
  public.is_active_member() and status in ('active', 'suspended')
);
create policy memberships_managers on public.memberships for select using (public.can_manage_roster(department_key));

create policy personnel_read on public.personnel_records for select using (public.can_view_personnel(department_key));

-- Shift logs: the submitter, and supervisors of that department (or DPS).
create policy shift_logs_own on public.shift_logs for select using (profile_id = auth.uid());
create policy shift_logs_supervisors on public.shift_logs for select using (
  status <> 'draft' and public.can_supervise(department_key)
);

create policy approval_actions_read on public.approval_actions for select using (
  submitter_id = auth.uid() or (department_key is not null and public.can_supervise(department_key))
);

-- Announcements: published district items for any active member; department items for that
-- department; drafts for command of the scope. Public visitors see only publicly approved items.
create policy announcements_public on public.announcements for select to anon using (
  status = 'published' and is_public and public_approved_at is not null
);
create policy announcements_members on public.announcements for select to authenticated using (
  (status = 'published' and (
     (scope = 'district' and public.is_active_member() and (
        public.is_dps() or exists (select 1 from public.memberships m where m.profile_id = auth.uid()
          and m.status = 'active' and public.tier_rank(m.tier) >= public.tier_rank(announcements.audience_min_tier))))
     or (scope = 'department' and public.has_tier(department_key, audience_min_tier))
     or (scope = 'department' and public.is_dps())
     or (is_public and public_approved_at is not null)))
  or (status <> 'published' and (
     public.is_dps() or (scope = 'department' and public.has_tier(department_key, 'high_command'))))
);

create policy policies_read on public.policies for select to authenticated using (
  (status in ('approved', 'superseded') and public.is_active_member()
     and (department_key is null or public.can_read_department(department_key)))
  or public.is_dps()
  or (department_key is not null and public.has_tier(department_key, 'high_command'))
);

create policy policy_acks_own on public.policy_acknowledgments for select using (
  profile_id = auth.uid() or public.is_dps()
);

create policy notifications_own on public.notifications for select using (profile_id = auth.uid());

create policy audit_read on public.audit_log for select using (
  public.is_admin() or public.is_dps()
  or (department_key is not null and public.has_tier(department_key, 'department_head'))
);

-- No INSERT/UPDATE/DELETE policies exist: with RLS on, direct writes from the browser are refused.

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
