import Link from 'next/link';
import { Fragment } from 'react';
import { Emblem } from '@/components/Emblem';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { dateOnly } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { atLeast, tierRank } from '@/lib/tiers';
import type { Membership, Rank } from '@/lib/types';
import { decideMembership } from '../actions';

export const metadata = { title: 'Roster' };

export default async function Roster({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  const visible = s.departments.filter((d) => d.active);
  const dept = visible.find((d) => d.key === sp.dept) ?? visible.find((d) => d.key === s.current?.department_key) ?? visible[0];
  const manage = s.canManageRoster(dept.key);

  const [{ data: members }, { data: ranks }] = await Promise.all([
    supabase.from('memberships').select('*').eq('department_key', dept.key).in('status', manage ? ['active', 'suspended', 'pending'] : ['active', 'suspended'])
      .order('display_name').returns<Membership[]>(),
    supabase.from('ranks').select('*').eq('department_key', dept.key).eq('active', true).order('sort_order').returns<Rank[]>(),
  ]);
  const rankOrder = new Map((ranks ?? []).map((r) => [r.id, r.sort_order]));
  const roster = (members ?? []).filter((m) => m.status !== 'pending')
    .sort((a, b) => (rankOrder.get(b.rank_id ?? '') ?? 0) - (rankOrder.get(a.rank_id ?? '') ?? 0) || a.display_name.localeCompare(b.display_name));
  const requests = (members ?? []).filter((m) => m.status === 'pending');
  const myTier = s.tierIn(dept.key);
  const grantable = (ranks ?? []).filter((r) =>
    s.oversees(dept.key) || s.isAdmin ? true : !atLeast(r.tier, 'department_head') && tierRank(r.tier) < tierRank(myTier));
  const onDuty = roster.filter((m) => m.duty_status === 'on_duty' && m.status === 'active').length;
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = q ? roster.filter((m) => [m.display_name, m.callsign, m.badge, m.rank_name].some((v) => v?.toLowerCase().includes(q))) : roster;

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow={`${onDuty} on duty · ${roster.length} listed`} title={`${dept.short_name} roster`}>
        <div className="flex gap-1">
          {visible.map((d) => (
            <Link key={d.key} href={`/hub/roster?dept=${d.key}`}
              className={`rounded-full px-3 py-1.5 text-[13px] ${d.key === dept.key ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{d.short_name}</Link>
          ))}
        </div>
      </PageHead>

      {manage && requests.length > 0 && (
        <section className="mb-10">
          <h2 className="label mb-4">Requests to join · {requests.length}</h2>
          <div className="grid gap-3">
            {requests.map((m) => (
              <div key={m.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[15px] font-medium">{m.display_name}</div>
                  <div className="text-[12px] text-faint">{m.ref} · {dateOnly(m.created_at)}</div>
                </div>
                {m.request_note && <p className="mt-2 text-[14px] whitespace-pre-line text-muted">{m.request_note}</p>}
                {m.profile_id === s.userId ? (
                  <p className="mt-3 text-[13px] text-faint">Another commander must decide your own request.</p>
                ) : (
                  <form className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="back" value={`/hub/roster?dept=${dept.key}`} />
                    <label className="field"><span>Starting rank</span>
                      <select name="rank" className="input" defaultValue={grantable[0]?.id}>
                        {grantable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>Callsign</span><input name="callsign" className="input" maxLength={16} /></label>
                    <label className="field"><span>Badge</span><input name="badge" className="input" maxLength={16} /></label>
                    <label className="field sm:col-span-3"><span>Reason (required to deny)</span><input name="reason" className="input" maxLength={600} /></label>
                    <div className="flex gap-2 sm:col-span-3">
                      <button formAction={decideMembership.bind(null, 'approve')} className="btn-primary btn-sm">Add to roster</button>
                      <button formAction={decideMembership.bind(null, 'deny')} className="btn-danger btn-sm">Deny</button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {roster.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Emblem dept={dept.key} label={dept.short_name} accent={dept.accent} division={dept.division} size={40} />
          <form className="flex min-w-60 flex-1 gap-2">
            <input type="hidden" name="dept" value={dept.key} />
            <input name="q" className="input" defaultValue={sp.q ?? ''} placeholder="Search name, callsign, badge or rank" />
            <button className="btn">Search</button>
          </form>
          {q && <Link href={`/hub/roster?dept=${dept.key}`} className="text-[13px] text-muted hover:text-ink">Clear</Link>}
        </div>
      )}

      {shown.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Callsign</th><th>Name</th><th>Rank</th><th>Duty</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((m, i) => (
                <Fragment key={m.id}>
                {(i === 0 || shown[i - 1].rank_name !== m.rank_name) && !q && (
                  <tr><td colSpan={5} className="!pt-5 !pb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">{m.rank_name ?? 'No rank'}</td></tr>
                )}
                <tr className="hover:bg-white/[0.02]">
                  <td className="font-mono text-[13px] text-gold">{m.callsign ?? '—'}</td>
                  <td>
                    <Link href={`/hub/roster/${m.id}`} className="hover:text-gold">{m.display_name}</Link>
                    {!m.profile_id && <span className="ml-2 text-[12px] text-faint">not linked</span>}
                    {m.leave_until && m.leave_until >= new Date().toISOString().slice(0, 10) && <span className="tag tag-warn ml-2">LOA</span>}
                  </td>
                  <td className="text-muted">{m.rank_name}</td>
                  <td>{m.duty_status === 'on_duty' ? <span className="tag tag-ok"><span className="on-duty-ring h-1.5 w-1.5 rounded-full bg-ok" />On duty</span> : <span className="text-faint">Off</span>}</td>
                  <td>{m.status !== 'active' ? <StatusTag status={m.status} /> : <span className="text-faint">Active</span>}</td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>{q ? 'Nobody matches that search.' : 'No one on this roster yet.'}</Empty>}
      <p className="mt-4 text-[12px] text-faint">Members on leave are marked LOA. Please do not contact them about activity.</p>
    </>
  );
}
