'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendly } from '@/lib/errors';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

// Every write is a call to a database function that re-checks the caller's authority.
// Nothing here decides permissions; it only collects input and reports the outcome.

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === null ? null : Number(v);
};

// Only same-site relative paths, so a crafted form cannot bounce people elsewhere.
function safePath(p: string | null, fallback: string) {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : fallback;
}

function flash(path: string, kind: 'ok' | 'error', message: string): never {
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.delete('ok');
  params.delete('error');
  params.set(kind, message);
  redirect(`${base}?${params.toString()}`);
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data: data as T, error };
}

async function act(form: FormData, fn: string, args: Record<string, unknown>, ok: string, fallback = '/hub') {
  const back = safePath(str(form, 'back'), fallback);
  const { error } = await rpc(fn, args);
  revalidatePath('/hub', 'layout');
  if (error) flash(back, 'error', friendly(error));
  flash(back, 'ok', ok);
}

// ---------------------------------------------------------------- session

export async function setActiveDepartment(form: FormData) {
  const { error } = await rpc('set_active_department', { p_department: str(form, 'department') });
  revalidatePath('/hub', 'layout');
  const back = safePath(str(form, 'back'), '/hub');
  if (error) flash(back, 'error', friendly(error));
  redirect(back);
}

export async function setDuty(form: FormData) {
  const dept = str(form, 'department');
  const status = str(form, 'status');
  const since = str(form, 'since');
  const { error } = await rpc('set_duty_status', { p_department: dept, p_status: status });
  revalidatePath('/hub', 'layout');
  if (error) flash('/hub', 'error', friendly(error));
  // Clocking out opens a prefilled shift log; nothing is submitted until the member confirms.
  if (status === 'off_duty' && since) {
    const q = new URLSearchParams({ dept: dept ?? '', start: since, end: new Date().toISOString() });
    redirect(`/hub/shifts/new?${q.toString()}`);
  }
  redirect('/hub');
}

export async function updateProfile(form: FormData) {
  await act(form, 'update_my_profile', { p_display_name: str(form, 'display_name'), p_psn_id: str(form, 'psn_id') },
    'Profile saved.', '/hub/profile');
}

export async function markRead(form: FormData) {
  const { error } = await rpc('mark_notifications_read', { p_id: str(form, 'id') });
  revalidatePath('/hub', 'layout');
  const back = safePath(str(form, 'back'), '/hub/notifications');
  if (error) flash(back, 'error', friendly(error));
  const link = str(form, 'link');
  redirect(link ? safePath(link, back) : back);
}

// ------------------------------------------------------------- shift logs

export interface ShiftFormState { error?: string; savedId?: string; version?: number }

export async function saveShift(_prev: ShiftFormState, form: FormData): Promise<ShiftFormState> {
  const submit = form.get('intent') === 'submit';
  const { data, error } = await rpc<{ id: string; version: number; ref: string; status: string }>('save_shift_log', {
    p_id: str(form, 'id'),
    p_department: str(form, 'department'),
    p_started_at: str(form, 'started_at'),
    p_ended_at: str(form, 'ended_at'),
    p_break_minutes: num(form, 'break_minutes') ?? 0,
    p_activity_type: str(form, 'activity_type'),
    p_summary: str(form, 'summary') ?? '',
    p_cad_reference: str(form, 'cad_reference'),
    p_recording_url: str(form, 'recording_url'),
    p_bodycam_status: str(form, 'bodycam_status'),
    p_bodycam_explanation: str(form, 'bodycam_explanation'),
    p_submit: submit,
    p_expected_version: num(form, 'version'),
  });
  if (error) return { error: friendly(error) };
  revalidatePath('/hub', 'layout');
  flash(`/hub/shifts/${data.id}`, 'ok', submit ? `${data.ref} submitted for review.` : `${data.ref} saved as a draft.`);
}

export async function withdrawShift(form: FormData) {
  const id = str(form, 'id');
  await act(form, 'withdraw_shift_log', { p_id: id, p_reason: str(form, 'reason') }, 'Shift log withdrawn.', `/hub/shifts/${id}`);
}

export async function decideShift(action: string, form: FormData) {
  const msg: Record<string, string> = {
    approve: 'Approved.', deny: 'Denied.', return: 'Returned to the member for correction.',
    escalate: 'Escalated to division command.', claim: 'Claimed. It is now under your review.',
  };
  await act(form, 'decide_shift_log', { p_id: str(form, 'id'), p_action: action, p_reason: str(form, 'reason') },
    msg[action] ?? 'Done.', '/hub/approvals');
}

// ---------------------------------------------------------------- roster

export async function requestMembership(form: FormData) {
  const back = safePath(str(form, 'back'), '/hub');
  const rpName = str(form, 'rp_name');
  const experience = str(form, 'experience');
  if (!rpName || rpName.length < 2) flash(back, 'error', 'Enter your roleplay name.');
  if (experience !== 'Yes' && experience !== 'No') flash(back, 'error', 'Say whether you have previous experience.');
  // The roster entry takes the profile's display name, so set the roleplay name first.
  const me = (await requireSession()).profile;
  if (me.display_name !== rpName) {
    const { error } = await rpc('update_my_profile', { p_display_name: rpName, p_psn_id: me.psn_id });
    if (error) flash(back, 'error', friendly(error));
  }
  const note = [`Previous experience: ${experience}`, str(form, 'note')].filter(Boolean).join('\n');
  await act(form, 'request_membership', { p_department: str(form, 'department'), p_note: note },
    'Request sent. Command will review it.', '/hub');
}

export async function decideMembership(action: string, form: FormData) {
  await act(form, 'decide_membership', {
    p_membership: str(form, 'id'), p_action: action, p_rank: str(form, 'rank'),
    p_callsign: str(form, 'callsign'), p_badge: str(form, 'badge'), p_reason: str(form, 'reason'),
  }, action === 'approve' ? 'Added to the roster.' : 'Request denied.', '/hub/roster');
}

export async function updateMembership(form: FormData) {
  const id = str(form, 'id');
  await act(form, 'update_membership', {
    p_membership: id,
    p_rank: str(form, 'rank'),
    p_callsign: form.has('callsign') ? (str(form, 'callsign') ?? '') : null,
    p_badge: form.has('badge') ? (str(form, 'badge') ?? '') : null,
    p_status: str(form, 'status'),
    p_leave_until: str(form, 'leave_until'),
    p_clear_leave: form.get('clear_leave') === 'on',
    p_can_view_personnel: form.has('personnel_present') ? form.get('can_view_personnel') === 'on' : null,
    p_reason: str(form, 'reason'),
  }, 'Roster updated.', `/hub/roster/${id}`);
}

// ---------------------------------------------------------- announcements

export async function saveAnnouncement(intent: 'publish' | 'draft', form: FormData) {
  const [scopeFromPicker, deptFromPicker] = (str(form, 'scope_dept') ?? '').split(':');
  const scope = scopeFromPicker || (str(form, 'scope') ?? 'department');
  if (deptFromPicker) form.set('department', deptFromPicker);
  await act(form, 'save_announcement', {
    p_id: str(form, 'id'), p_title: str(form, 'title'), p_body: str(form, 'body') ?? '',
    p_scope: scope, p_department: scope === 'department' ? str(form, 'department') : null,
    p_priority: str(form, 'priority'), p_audience_min_tier: str(form, 'audience'),
    p_pinned: form.get('pinned') === 'on', p_publish: intent === 'publish',
  }, intent === 'publish' ? 'Published.' : 'Draft saved.', '/hub/announcements');
}

export async function setAnnouncementPublic(form: FormData) {
  const on = form.get('public') === '1';
  await act(form, 'set_announcement_public', { p_id: str(form, 'id'), p_public: on },
    on ? 'Approved for the public site.' : 'Removed from the public site.', '/hub/announcements');
}

// ---------------------------------------------------------------- admin

export async function adminUpdateDepartment(form: FormData) {
  const quotaHours = num(form, 'quota_hours');
  await act(form, 'admin_update_department', {
    p_key: str(form, 'key'),
    p_quota_minutes: quotaHours === null ? null : Math.round(quotaHours * 60),
    p_week_starts_on: num(form, 'week_starts_on'),
    p_timezone: str(form, 'timezone'),
    p_bodycam_required: form.get('bodycam_required') === 'on',
    p_bodycam_policy_text: str(form, 'bodycam_policy_text'),
    p_bodycam_policy_url: str(form, 'bodycam_policy_url'),
  }, 'Department settings saved.', '/hub/admin');
}

export async function adminSaveRank(form: FormData) {
  await act(form, 'admin_save_rank', {
    p_id: str(form, 'id'), p_department: str(form, 'department'), p_name: str(form, 'name'),
    p_abbreviation: str(form, 'abbreviation'), p_tier: str(form, 'tier'), p_sort: num(form, 'sort_order'),
    p_active: form.get('active') !== 'off',
  }, 'Rank saved.', '/hub/admin?tab=ranks');
}

export async function adminSaveRoute(form: FormData) {
  await act(form, 'admin_save_route', {
    p_record_type: 'shift_log', p_department: str(form, 'department'),
    p_submitter: str(form, 'submitter'), p_required: str(form, 'required'),
  }, 'Review route saved.', '/hub/admin?tab=routing');
}

export async function adminSetSetting(form: FormData) {
  await act(form, 'admin_set_setting', { p_key: str(form, 'key'), p_value: str(form, 'value') },
    'Setting saved.', '/hub/admin');
}

export async function adminDemo(intent: 'seed' | 'clear', form: FormData) {
  const clear = intent === 'clear';
  await act(form, clear ? 'admin_clear_demo' : 'admin_seed_demo', {},
    clear ? 'Demo data removed.' : 'Demo data loaded. Every demo row is labeled [DEMO].', '/hub/admin');
}

// An administrator puts their own account on a roster, usually at a command rank.
export async function adminAddSelf(form: FormData) {
  const back = '/hub/admin';
  const s = await requireSession();
  const [dept, rank] = (str(form, 'rank') ?? '').split('|');
  if (!dept || !rank) flash(back, 'error', 'Choose a department and rank.');
  if (!s.profile.discord_id) flash(back, 'error', 'Your account has no Discord ID yet. Sign out and back in with Discord.');
  await act(form, 'admin_add_roster_member', {
    p_department: dept, p_display_name: s.profile.display_name, p_discord_id: s.profile.discord_id, p_rank: rank,
    p_callsign: str(form, 'callsign'), p_badge: null, p_join_date: null,
  }, 'You are on the roster. Reload any page to see the full hub.', back);
}

// One roster row per line: department, name, discord id, rank, callsign, badge
export async function adminImportRoster(form: FormData) {
  const back = '/hub/admin?tab=import';
  const supabase = await createClient();
  const { data: ranks } = await supabase.from('ranks').select('id,department_key,name,abbreviation');
  const lines = (str(form, 'rows') ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) flash(back, 'error', 'Paste at least one row.');
  const problems: string[] = [];
  let added = 0;
  for (const [i, line] of lines.entries()) {
    const [dept, name, discord, rank, callsign, badge] = line.split(',').map((c) => c.trim());
    const r = (ranks ?? []).find((x) => x.department_key === dept?.toLowerCase() &&
      (x.name.toLowerCase() === rank?.toLowerCase() || (x.abbreviation ?? '').toLowerCase() === rank?.toLowerCase()));
    if (!r) { problems.push(`line ${i + 1}: rank "${rank}" not found in ${dept}`); continue; }
    const { error } = await supabase.rpc('admin_add_roster_member', {
      p_department: dept.toLowerCase(), p_display_name: name, p_discord_id: discord || null, p_rank: r.id,
      p_callsign: callsign || null, p_badge: badge || null, p_join_date: null,
    });
    if (error) problems.push(`line ${i + 1}: ${friendly(error)}`);
    else added++;
  }
  revalidatePath('/hub', 'layout');
  if (problems.length) flash(back, 'error', `Added ${added}. ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '…' : ''}`);
  flash(back, 'ok', `Added ${added} roster ${added === 1 ? 'entry' : 'entries'}. Each links to its member at first Discord sign-in.`);
}

// ------------------------------------------------------- reports & requests

export interface SubmissionFormState { error?: string }

export async function saveSubmission(_prev: SubmissionFormState, form: FormData): Promise<SubmissionFormState> {
  const submit = form.get('intent') === 'submit';
  const details: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith('f_') && typeof v === 'string' && v.trim()) details[k.slice(2)] = v.trim();
  }
  const { data, error } = await rpc<{ id: string; ref: string; title: string }>('save_submission', {
    p_id: str(form, 'id'),
    p_kind: str(form, 'kind'),
    p_department: str(form, 'department'),
    p_details: details,
    p_evidence_url: str(form, 'evidence_url'),
    p_occurred_on: str(form, 'occurred_on'),
    p_expires_at: str(form, 'expires_at'),
    p_subject: str(form, 'subject'),
    p_submit: submit,
    p_expected_version: num(form, 'version'),
  });
  if (error) return { error: friendly(error) };
  revalidatePath('/hub', 'layout');
  flash(`/hub/reports/${data.id}`, 'ok', submit ? `${data.ref} sent for review.` : `${data.ref} saved as a draft.`);
}

export async function withdrawSubmission(form: FormData) {
  const id = str(form, 'id');
  await act(form, 'withdraw_submission', { p_id: id, p_reason: str(form, 'reason') }, 'Withdrawn.', `/hub/reports/${id}`);
}

export async function decideSubmission(action: string, form: FormData) {
  const msg: Record<string, string> = {
    approve: 'Approved.', deny: 'Denied.', return: 'Returned to the member for correction.',
    escalate: 'Escalated to division command.', claim: 'Claimed. It is now under your review.', archive: 'Cleared from the active list.',
  };
  await act(form, 'decide_submission', { p_id: str(form, 'id'), p_action: action, p_reason: str(form, 'reason') },
    msg[action] ?? 'Done.', '/hub/approvals');
}

export async function revokeCertification(form: FormData) {
  await act(form, 'revoke_certification', { p_id: str(form, 'id'), p_reason: str(form, 'reason') }, 'Certification revoked.', '/hub/roster');
}

// ------------------------------------------------------------- materials

export async function savePolicy(form: FormData) {
  const dept = str(form, 'department');
  await act(form, 'save_policy', {
    p_id: str(form, 'id'), p_title: str(form, 'title'), p_category: str(form, 'category'),
    p_department: dept === 'district' ? null : dept, p_version: str(form, 'version'), p_summary: str(form, 'summary'),
    p_body: null, p_source_url: str(form, 'source_url'), p_requires_ack: form.get('requires_ack') === 'on',
    p_effective: null, p_approve: true,
  }, 'Saved to the library.', '/hub/resources');
}

export async function acknowledgePolicy(form: FormData) {
  await act(form, 'acknowledge_policy', { p_policy: str(form, 'id') }, 'Acknowledged.', '/hub/resources');
}

export async function adminSaveOption(form: FormData) {
  await act(form, 'admin_save_option', {
    p_id: str(form, 'id'), p_department: str(form, 'department'), p_kind: str(form, 'kind'), p_name: str(form, 'name'),
    p_description: str(form, 'description'), p_min_tier: str(form, 'min_tier'), p_open: form.get('is_open') === 'on',
    p_sort: num(form, 'sort_order'), p_active: form.get('active') !== 'off',
  }, 'Saved.', '/hub/admin?tab=options');
}
