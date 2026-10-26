export function hours(minutes: number) {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function dateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(iso));
}

export function timeOnly(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function dateOnly(iso: string, tz?: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('en-US', { timeZone: tz ?? 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function relative(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function todayLabel(tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under review', returned: 'Returned',
  approved: 'Approved', denied: 'Denied', withdrawn: 'Withdrawn', archived: 'Archived',
  pending: 'Pending', active: 'Active', suspended: 'Suspended', removed: 'Removed',
};

export const ACTIVITY_LABEL: Record<string, string> = {
  patrol: 'Patrol', traffic: 'Traffic enforcement', training: 'Training', administrative: 'Administrative',
  special_assignment: 'Special assignment', supervision: 'Supervision',
};

export const BODYCAM_LABEL: Record<string, string> = {
  recorded: 'Recorded', unavailable: 'Unavailable', not_applicable: 'Not applicable', not_required: 'Not recorded',
};
