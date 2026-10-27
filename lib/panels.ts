import type { Session } from './session';
import type { Department } from './types';

// Each department has three panels, opened by rank tier:
// supervisor (Sgt and up), command staff (high command) and administration (department heads).
export const PANELS = [
  { key: 'supervisor', href: '/hub/command', label: 'Supervisor panel', who: 'Supervisors and up' },
  { key: 'staff', href: '/hub/command/staff', label: 'Command staff panel', who: 'High command and up' },
  { key: 'admin', href: '/hub/command/admin', label: 'Administration panel', who: 'Department heads' },
] as const;
export type PanelKey = (typeof PANELS)[number]['key'];

export function canOpen(s: Session, panel: PanelKey, dept: string) {
  if (panel === 'supervisor') return s.canSupervise(dept);
  if (panel === 'staff') return s.canManageRoster(dept);
  return s.canAdminister(dept);
}

/** Departments where this panel opens for the caller, with the one to show. */
export function panelDepts(s: Session, panel: PanelKey, wanted?: string) {
  const list = s.departments.filter((d) => d.kind === 'department' && d.active && canOpen(s, panel, d.key));
  const dept: Department | undefined = list.find((d) => d.key === wanted) ?? list.find((d) => d.key === s.current?.department_key) ?? list[0];
  return { list, dept };
}
