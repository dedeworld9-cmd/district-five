import { KIND } from './kinds';
import type { Session } from './session';
import { createClient } from './supabase/server';
import type { DepartmentOption, Membership } from './types';

// Departments where the caller can file this kind, plus select options and FTO trainees.
export async function formContext(s: Session, kind: string) {
  const cfg = KIND[kind];
  const depts = s.departments.filter((d) => d.kind === 'department' && cfg?.divisions.includes(d.division)
    && s.active.some((m) => m.department_key === d.key));
  const keys = depts.map((d) => d.key);
  const supabase = await createClient();
  const [{ data: opts }, { data: probies }] = await Promise.all([
    cfg?.fields.some((f) => f.optionsFrom)
      ? supabase.from('department_options').select('*').in('department_key', keys).eq('active', true).eq('is_open', true)
          .order('sort_order').returns<DepartmentOption[]>()
      : Promise.resolve({ data: [] as DepartmentOption[] }),
    cfg?.subject
      ? supabase.from('memberships').select('id,display_name,department_key,profile_id,tier,is_probationary').in('department_key', keys)
          .eq('status', 'active').returns<Membership[]>()
      : Promise.resolve({ data: [] as Membership[] }),
  ]);
  const from = cfg?.fields.find((f) => f.optionsFrom)?.optionsFrom;
  const options: Record<string, string[]> = {};
  for (const o of opts ?? []) if (o.kind === from) (options[o.department_key] ??= []).push(o.name);
  const subjects: Record<string, { id: string; name: string }[]> = {};
  for (const m of probies ?? []) {
    if ((m.is_probationary || m.tier === 'probationary') && m.profile_id !== s.userId) {
      (subjects[m.department_key] ??= []).push({ id: m.id, name: m.display_name });
    }
  }
  return { cfg, depts, options, subjects };
}
