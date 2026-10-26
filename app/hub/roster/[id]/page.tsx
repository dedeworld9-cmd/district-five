import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash, PageHead, StatusTag } from '@/components/ui';
import { dateOnly } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIER_LABEL, atLeast, tierRank } from '@/lib/tiers';
import type { Membership, PersonnelRecord, Rank } from '@/lib/types';
import { updateMembership } from '../../actions';

export const metadata = { title: 'Member' };

export default async function Member({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireSession();
  const supabase = await createClient();
  const { data: m } = await supabase.from('memberships').select('*').eq('id', id).maybeSingle<Membership>();
  if (!m) notFound();
  const [{ data: ranks }, { data: records }] = await Promise.all([
    supabase.from('ranks').select('*').eq('department_key', m.department_key).eq('active', true).order('sort_order').returns<Rank[]>(),
    supabase.from('personnel_records').select('*').eq('membership_id', id).order('created_at', { ascending: false }).returns<PersonnelRecord[]>(),
  ]);
  const dept = s.departments.find((d) => d.key === m.department_key);
  const manage = s.canManageRoster(m.department_key) && (m.profile_id !== s.userId || s.isAdmin) && !['pending', 'denied'].includes(m.status);
  const myTier = s.tierIn(m.department_key);
  const grantable = (ranks ?? []).filter((r) => r.id === m.rank_id ||
    (s.isDps || s.isAdmin ? true : !atLeast(r.tier, 'department_head') && tierRank(r.tier) < tierRank(myTier)));
  const canGrantPersonnel = s.isDps || atLeast(myTier, 'department_head');
  const back = `/hub/roster/${m.id}`;

  return (
    <div className="max-w-3xl">
      <Flash searchParams={sp} />
      <PageHead eyebrow={`${dept?.short_name} · ${m.ref}`} title={m.display_name}><StatusTag status={m.status} /></PageHead>

      <dl className="card grid gap-x-6 gap-y-4 p-6 text-[14px] sm:grid-cols-3">
        <div><dt className="label">Rank</dt><dd className="mt-1">{m.rank_name ?? '—'}</dd></div>
        <div><dt className="label">Callsign</dt><dd className="mt-1 font-mono text-gold">{m.callsign ?? '—'}</dd></div>
        <div><dt className="label">Badge</dt><dd className="mt-1">{m.badge ?? '—'}</dd></div>
        <div><dt className="label">Tier</dt><dd className="mt-1">{TIER_LABEL[m.tier]}</dd></div>
        <div><dt className="label">Joined</dt><dd className="mt-1">{m.join_date ? dateOnly(m.join_date) : '—'}</dd></div>
        <div><dt className="label">Leave</dt><dd className="mt-1">{m.leave_until ? `Until ${dateOnly(m.leave_until)}` : 'None'}</dd></div>
        {!m.profile_id && <div className="sm:col-span-3 text-[13px] text-faint">Not linked to an account yet. It links when this member first signs in with Discord.</div>}
      </dl>

      {manage && (
        <form action={updateMembership} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="label sm:col-span-2">Change roster entry</h2>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="back" value={back} />
          <label className="field"><span>Rank</span>
            <select name="rank" className="input" defaultValue={m.rank_id ?? ''}>
              {grantable.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_sample ? ' (sample)' : ''}</option>)}
            </select>
          </label>
          <label className="field"><span>Status</span>
            <select name="status" className="input" defaultValue={m.status}>
              <option value="active">Active</option><option value="suspended">Suspended</option><option value="removed">Removed</option>
            </select>
          </label>
          <label className="field"><span>Callsign</span><input name="callsign" className="input" defaultValue={m.callsign ?? ''} maxLength={16} /></label>
          <label className="field"><span>Badge</span><input name="badge" className="input" defaultValue={m.badge ?? ''} maxLength={16} /></label>
          <label className="field"><span>Leave of absence until</span><input type="date" name="leave_until" className="input" defaultValue={m.leave_until ?? ''} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-[14px] text-muted"><input type="checkbox" name="clear_leave" /> End leave now</label>
          {canGrantPersonnel && (
            <label className="flex items-center gap-2 text-[14px] text-muted sm:col-span-2">
              <input type="hidden" name="personnel_present" value="1" />
              <input type="checkbox" name="can_view_personnel" defaultChecked={m.can_view_personnel} /> May read confidential personnel records
            </label>
          )}
          <label className="field sm:col-span-2"><span>Reason (kept in the personnel record)</span><input name="reason" className="input" required minLength={3} maxLength={600} /></label>
          <div className="sm:col-span-2"><button className="btn-primary">Save change</button></div>
        </form>
      )}

      <section className="mt-10">
        <h2 className="label mb-4">Personnel record</h2>
        {records?.length ? (
          <ol className="card divide-y divide-line">
            {records.map((r) => (
              <li key={r.id} className="px-5 py-4 text-[14px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-[12px] text-faint">{dateOnly(r.effective_date)} · {r.created_by_name}</span>
                </div>
                {r.detail && <p className="mt-1 text-muted">{r.detail}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[14px] text-muted">
            {s.isDps || atLeast(myTier, 'department_head') || s.active.some((x) => x.can_view_personnel)
              ? 'No personnel entries yet.'
              : 'Personnel records are visible only to department heads and members they authorize.'}
          </p>
        )}
      </section>
      <Link href={`/hub/roster?dept=${m.department_key}`} className="mt-8 inline-block text-[13px] text-muted hover:text-ink">← Roster</Link>
    </div>
  );
}
