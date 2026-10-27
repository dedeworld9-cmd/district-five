import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PanelTabs } from '@/components/PanelTabs';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { dateOnly, hours, relative } from '@/lib/format';
import { panelDepts } from '@/lib/panels';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { atLeast, tierRank } from '@/lib/tiers';
import type { ComplianceRow, Membership, Rank, Submission } from '@/lib/types';
import { adminImportRoster, decideMembership } from '../../actions';

export const metadata = { title: 'Command staff panel' };

// High command: who joins, who moves up, who needs a check-in.
export default async function StaffPanel({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const { list: depts, dept } = panelDepts(s, 'staff', sp.dept);
  if (!dept) redirect('/hub/command');
  const supabase = await createClient();
  const back = `/hub/command/staff?dept=${dept.key}`;

  const [{ data: members }, { data: ranks }, { data: updates }, { data: compliance }] = await Promise.all([
    supabase.from('memberships').select('*').eq('department_key', dept.key).in('status', ['active', 'suspended', 'pending'])
      .order('display_name').returns<Membership[]>(),
    supabase.from('ranks').select('*').eq('department_key', dept.key).eq('active', true).order('sort_order').returns<Rank[]>(),
    supabase.from('submissions').select('id,ref,title,status,created_at').eq('department_key', dept.key).eq('kind', 'roster_update')
      .in('status', ['submitted', 'under_review']).order('created_at').returns<Pick<Submission, 'id' | 'ref' | 'title' | 'status' | 'created_at'>[]>(),
    supabase.rpc('department_compliance', { p_department: dept.key }),
  ]);

  const all = members ?? [];
  const requests = all.filter((m) => m.status === 'pending');
  const active = all.filter((m) => m.status === 'active');
  const today = new Date().toISOString().slice(0, 10);
  const watch = [
    { label: 'On probation', list: active.filter((m) => m.is_probationary), note: (m: Membership) => m.join_date ? `Joined ${dateOnly(m.join_date)}` : '' },
    { label: 'On leave', list: active.filter((m) => m.leave_until && m.leave_until >= today), note: (m: Membership) => `Until ${dateOnly(m.leave_until!)}` },
    { label: 'Suspended', list: all.filter((m) => m.status === 'suspended'), note: () => '' },
  ];
  const below = ((compliance ?? []) as ComplianceRow[]).filter((r) => !r.on_leave && r.approved_minutes < r.quota_minutes);
  const myTier = s.tierIn(dept.key);
  const grantable = (ranks ?? []).filter((r) =>
    s.oversees(dept.key) || s.isAdmin ? true : !atLeast(r.tier, 'department_head') && tierRank(r.tier) < tierRank(myTier));

  const tiles = [
    { label: 'Join requests', value: requests.length, gold: requests.length > 0 },
    { label: 'Roster updates', value: (updates ?? []).length, gold: (updates ?? []).length > 0 },
    { label: 'Below quota', value: below.length, warn: below.length > 0 },
    { label: 'Active members', value: active.length },
  ];

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow={dept.name} title="Command staff panel" />
      <PanelTabs s={s} panel="staff" dept={dept} depts={depts} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`card p-5 ${t.gold ? 'border-gold/30' : ''}`}>
            <div className="label">{t.label}</div>
            <div className={`mt-3 text-[30px] font-semibold tracking-tight ${t.gold ? 'text-gold' : t.warn ? 'text-warn' : ''}`}>{t.value}</div>
          </div>
        ))}
      </section>

      <div className="mt-12 grid gap-12">
        <section>
          <h2 className="label mb-4">Requests to join</h2>
          {requests.length ? (
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
                      <input type="hidden" name="back" value={back} />
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
          ) : <Empty>No one is waiting to join.</Empty>}
        </section>

        <section>
          <h2 className="label mb-4">Roster update requests</h2>
          {updates?.length ? (
            <div className="card divide-y divide-line">
              {updates.map((u) => (
                <Link key={u.id} href={`/hub/reports/${u.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-white/[0.02]">
                  <span className="text-[14px]"><span className="mr-2 font-mono text-[12px] text-muted">{u.ref}</span>{u.title}</span>
                  <span className="flex items-center gap-3 text-[12px] text-faint">{relative(u.created_at)} <StatusTag status={u.status} /></span>
                </Link>
              ))}
            </div>
          ) : <Empty>No rank changes, removals or LOA requests waiting.</Empty>}
          <p className="mt-2 text-[12px] text-faint">Promotions, demotions and suspensions are made from each member&apos;s roster page.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {[...watch, { label: 'Below quota this week', list: [] as Membership[], note: () => '' }].map((g) => (
            <div key={g.label}>
              <h2 className="label mb-3">{g.label}</h2>
              {g.label === 'Below quota this week' ? (
                below.length ? (
                  <div className="card divide-y divide-line">
                    {below.map((r) => (
                      <Link key={r.membership_id} href={`/hub/roster/${r.membership_id}`} className="flex justify-between px-4 py-2.5 text-[14px] hover:bg-white/[0.02]">
                        <span>{r.callsign && <span className="mr-2 font-mono text-[12px] text-gold">{r.callsign}</span>}{r.display_name}</span>
                        <span className="text-muted">{hours(r.approved_minutes)} of {hours(r.quota_minutes)}</span>
                      </Link>
                    ))}
                  </div>
                ) : <Empty>Everyone is on track.</Empty>
              ) : g.list.length ? (
                <div className="card divide-y divide-line">
                  {g.list.map((m) => (
                    <Link key={m.id} href={`/hub/roster/${m.id}`} className="flex justify-between gap-3 px-4 py-2.5 text-[14px] hover:bg-white/[0.02]">
                      <span>{m.callsign && <span className="mr-2 font-mono text-[12px] text-gold">{m.callsign}</span>}{m.display_name}
                        <span className="ml-2 text-[12px] text-faint">{m.rank_name}</span></span>
                      <span className="text-[12px] text-muted">{g.note(m)}</span>
                    </Link>
                  ))}
                </div>
              ) : <Empty>Nobody.</Empty>}
            </div>
          ))}
        </section>

        <section>
          <h2 className="label mb-3">Add members from an existing roster</h2>
          <form action={adminImportRoster} className="card grid gap-4 p-6">
            <input type="hidden" name="department" value={dept.key} />
            <input type="hidden" name="back" value={back} />
            <p className="text-[13px] leading-relaxed text-muted">
              One member per line: <code className="text-ink">name, discord id, rank, callsign, badge</code>. Rank can be the full name or abbreviation.
              Each entry links to its member the first time they sign in with that Discord account.
            </p>
            <textarea name="rows" className="input font-mono text-[13px]" rows={5} placeholder={'J. Doe, 123456789012345678, Sergeant, 1S-10, 1010'} />
            <div><button className="btn-primary btn-sm">Add to {dept.short_name}</button></div>
          </form>
        </section>

        <section className="flex flex-wrap gap-2">
          <Link href={`/hub/roster?dept=${dept.key}`} className="btn btn-sm">Full roster</Link>
          <Link href="/hub/announcements" className="btn btn-sm">Post an announcement</Link>
          <Link href={`/hub/records?dept=${dept.key}`} className="btn btn-sm">All records</Link>
        </section>
      </div>
    </>
  );
}
