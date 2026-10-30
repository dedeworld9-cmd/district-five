import type { Session } from './session';
import { SITE } from './site';
import { channelName, channelUrl, type ChannelKey } from './discord';

// The five workspaces of the member hub. Pages either live natively in the hub (href) or are
// gateways to a verified Discord channel. Gates are checked again on the server for every page;
// hiding a sidebar link is never the access control.
export type Gate = 'member' | 'supervisor' | 'command' | 'admin';

export type Page = {
  slug: string; label: string; desc: string; gate: Gate;
  href?: string; channel?: ChannelKey;
  also?: { label: string; href?: string; channel?: ChannelKey; gate?: Gate }[];
};
export type Workspace = { slug: string; label: string; blurb: string; gate: Gate; pages: Page[] };

export const WORKSPACES: Workspace[] = [
  { slug: 'department', label: 'Department Hub', gate: 'member',
    blurb: 'Official announcements, mass shifts, command information and department resources.',
    pages: [
      { slug: 'announcements', label: 'Announcements', gate: 'member', href: '/hub/announcements', desc: 'Department announcements.', also: [{ label: 'Open #announcements', channel: 'announcements' }] },
      { slug: 'mass-shifts', label: 'Mass Shifts', gate: 'member', channel: 'mass-shifts', desc: 'Mass shifts are scheduled and announced in Discord.' },
      { slug: 'command-information', label: 'Command Information', gate: 'member', channel: 'command-info', desc: 'The chain of command and command notices.', also: [{ label: 'Public chain of command', href: '/team' }] },
      { slug: 'resources', label: 'Resources', gate: 'member', href: '/hub/resources', desc: 'Standard operating procedures and guidance.', also: [{ label: 'Open #resources', channel: 'resources' }] },
    ] },
  { slug: 'patrol', label: 'Patrol', gate: 'member',
    blurb: 'Start a patrol, keep the timer, and reach patrol information and communications.',
    pages: [
      { slug: 'announcements', label: 'Patrol Announcements', gate: 'member', channel: 'patrol-announcements', desc: 'Announcements for patrol deputies.' },
      { slug: 'information', label: 'Information', gate: 'member', channel: 'patrol-information', desc: 'Patrol procedures and information.' },
      { slug: 'chat', label: 'Chat', gate: 'member', channel: 'patrol-chat', desc: 'Patrol chat lives in Discord.' },
      { slug: 'suggestions', label: 'Suggestions', gate: 'member', channel: 'patrol-suggestions', desc: 'Suggestions for patrol are collected in Discord.' },
    ] },
  { slug: 'logging', label: 'Logging', gate: 'member',
    blurb: 'Log activity, review your records and reach the department logging channels.',
    pages: [
      { slug: 'activity-logger', label: 'Activity Logger', gate: 'member', href: '/hub/shifts/new', desc: 'Log a patrol or activity.' },
      { slug: 'results', label: 'Results', gate: 'member', channel: 'results', desc: 'Results are posted in Discord.' },
      { slug: 'infractions', label: 'Infractions', gate: 'member', channel: 'infractions', desc: 'Infractions are recorded in Discord.' },
      { slug: 'shift-logs', label: 'Shift Logs', gate: 'member', href: '/hub/shifts', desc: 'Your submitted shift logs.', also: [{ label: 'Open #shift-logs', channel: 'shift-logs' }] },
      { slug: 'logs', label: 'Logs', gate: 'member', channel: 'logs', desc: 'General department logs.' },
      { slug: 'incident-reports', label: 'Supervisor Incident Reports', gate: 'member', href: '/hub/reports', desc: 'File and track reports.', also: [{ label: 'Open #sv-incident-reports', channel: 'sv-incident-reports', gate: 'supervisor' }] },
      { slug: 'warrants', label: 'Warrants', gate: 'member', channel: 'warrants', desc: 'Warrants are handled in Discord.' },
      { slug: 'backup-logs', label: 'Backup Logs', gate: 'member', channel: 'backup-logs', desc: 'Backup logs are kept in Discord.' },
    ] },
  { slug: 'training', label: 'Training & Range', gate: 'member',
    blurb: 'Examinations, qualification trainings and availability.',
    pages: [
      { slug: 'bls-exam', label: 'BLS Examination', gate: 'member', channel: 'bls-exam', desc: 'The BLS examination is run in Discord.' },
      { slug: 'qualification-trainings', label: 'Qualification Trainings', gate: 'member', channel: 'qualification-trainings', desc: 'Qualification trainings are announced in Discord.' },
      { slug: 'availability', label: 'Miscellaneous Availability', gate: 'member', channel: 'misc-availability', desc: 'Post your availability for miscellaneous training.' },
    ] },
  { slug: 'high-ranking', label: 'High Ranking', gate: 'supervisor',
    blurb: 'Authorized leadership resources and operations.',
    pages: [
      { slug: 'command-announcements', label: 'Command Announcements', gate: 'command', channel: 'command-announcements', desc: 'Announcements for command staff.' },
      { slug: 'supervisor-announcements', label: 'Supervisor Announcements', gate: 'supervisor', channel: 'sv-announcements', desc: 'Announcements for supervisors.' },
      { slug: 'supervisor-information', label: 'Supervisor Information', gate: 'supervisor', channel: 'sv-info', desc: 'Information for supervisors.' },
      { slug: 'command-chat', label: 'Command Chat', gate: 'command', channel: 'command-chat', desc: 'Command chat lives in Discord.' },
      { slug: 'supervisor-chat', label: 'Supervisor Chat', gate: 'supervisor', channel: 'supervisor-chat', desc: 'Supervisor chat lives in Discord.' },
      { slug: 'roster-updates', label: 'Roster Updates', gate: 'supervisor', href: '/hub/roster', desc: 'The department roster.', also: [{ label: 'Open #roster-updates', channel: 'roster-updates' }] },
      { slug: 'tools', label: 'High Command Tools', gate: 'command', desc: 'Authorized leadership tools.', also: [{ label: 'Open #hicom-commands', channel: 'hicom-commands' }] },
    ] },
];

export const WS = Object.fromEntries(WORKSPACES.map((w) => [w.slug, w])) as Record<string, Workspace>;

export const overviewHref = (w: Workspace) => (w.slug === 'department' ? '/hub/department' : `/hub/${w.slug}`);
export const pageHref = (w: Workspace, p: Page) => p.href ?? `/hub/${w.slug}/${p.slug}`;

// The one place a gate is turned into a yes or no. Mirrors the database rules; the database stays
// the authority for every write.
export function can(s: Session, gate: Gate): boolean {
  const d = SITE.department;
  switch (gate) {
    case 'member': return s.active.length > 0;
    case 'supervisor': return s.supervised.length > 0 || s.isAdmin;
    case 'command': return s.canManageRoster(d);
    case 'admin': return s.canAdminister(d);
  }
}

export const GATE_LABEL: Record<Gate, string> = {
  member: 'HCSO members', supervisor: 'Supervisors and above', command: 'Command staff', admin: 'Department administrators',
};

export function channelLink(k: ChannelKey) {
  return { name: `#${channelName(k)}`, url: channelUrl(k) };
}

// Plain serializable navigation the client shell renders. Only pages the member may open are in it.
export type NavPage = { label: string; href: string };
export type NavWorkspace = { slug: string; label: string; href: string; pages: NavPage[] };

export function navFor(s: Session): NavWorkspace[] {
  return WORKSPACES.filter((w) => can(s, w.gate)).map((w) => ({
    slug: w.slug, label: w.label, href: overviewHref(w),
    pages: [
      ...(w.slug === 'patrol' ? [{ label: 'Overview', href: '/hub/patrol' }] : [{ label: 'Overview', href: overviewHref(w) }]),
      ...w.pages.filter((p) => can(s, p.gate)).map((p) => ({ label: p.label, href: pageHref(w, p) })),
    ],
  }));
}

// Existing hub routes that sit under a workspace for breadcrumbs and the section tabs.
export const ROUTE_ALIAS: { prefix: string; ws: string; label: string }[] = [
  { prefix: '/hub/board', ws: 'patrol', label: 'On-duty board' },
  { prefix: '/hub/records', ws: 'logging', label: 'Records' },
  { prefix: '/hub/approvals', ws: 'high-ranking', label: 'Approvals' },
  { prefix: '/hub/command', ws: 'high-ranking', label: 'Panels' },
  { prefix: '/hub/admin', ws: 'high-ranking', label: 'Admin' },
];
