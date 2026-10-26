import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { atLeast } from './tiers';
import type { Department, Membership, Profile, Tier } from './types';

export interface Session {
  userId: string;
  profile: Profile;
  departments: Department[];
  /** Every membership row of mine, any status. */
  mine: Membership[];
  /** Active memberships only. */
  active: Membership[];
  /** Department currently selected in the switcher (an active membership), or null. */
  current: Membership | null;
  currentDept: Department | null;
  isDps: boolean;
  isAdmin: boolean;
  tierIn: (dept: string) => Tier | null;
  canSupervise: (dept: string) => boolean;
  canManageRoster: (dept: string) => boolean;
  /** Departments whose queues/rosters this person may supervise. */
  supervised: Department[];
}

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: mine }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>(),
    supabase.from('memberships').select('*').eq('profile_id', user.id).order('created_at').returns<Membership[]>(),
    supabase.from('departments').select('*').order('sort_order').returns<Department[]>(),
  ]);
  if (!profile) return null;

  const depts = departments ?? [];
  const all = mine ?? [];
  const active = all.filter((m) => m.status === 'active');
  const deptOf = (key: string) => depts.find((d) => d.key === key) ?? null;
  const isDps = active.some((m) => deptOf(m.department_key)?.kind === 'oversight');
  const current =
    active.find((m) => m.department_key === profile.active_department) ??
    active.find((m) => deptOf(m.department_key)?.kind === 'department') ??
    active[0] ?? null;

  const tierIn = (dept: string) => active.find((m) => m.department_key === dept)?.tier ?? null;
  const canSupervise = (dept: string) => isDps || atLeast(tierIn(dept), 'supervisor');
  const canManageRoster = (dept: string) => isDps || profile.is_admin || atLeast(tierIn(dept), 'high_command');

  return {
    userId: user.id,
    profile,
    departments: depts,
    mine: all,
    active,
    current,
    currentDept: current ? deptOf(current.department_key) : null,
    isDps,
    isAdmin: profile.is_admin,
    tierIn,
    canSupervise,
    canManageRoster,
    supervised: depts.filter((d) => d.kind === 'department' && canSupervise(d.key)),
  };
});

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export const DEFAULT_TZ = 'America/New_York';
export const tzOf = (s: Session, dept?: string | null) =>
  s.departments.find((d) => d.key === (dept ?? s.current?.department_key))?.timezone ?? DEFAULT_TZ;
