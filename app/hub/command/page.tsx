import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Emblem } from '@/components/Emblem';
import { PanelTabs } from '@/components/PanelTabs';
import { Empty, PageHead } from '@/components/ui';
import { panelDepts } from '@/lib/panels';
import { hours, relative } from '@/lib/format';
import { KIND } from '@/lib/kinds';
import { canDecide } from '@/lib/queue';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ApprovalAction, ComplianceRow, Membership, Submission, Tier } from '@/lib/types';

export const metadata = { title: 'Supervisor panel' };

type Open = { id: string; department_key: string; required_tier: Tier; profile_id: string };

// Supervisor and command overview: one department at a time, everything that needs attention.
export default async function Command({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const { list: depts, dept } = panelDepts(s, 'supervisor', sp.dept);
  if (!dept) redirect('/hub');
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: members }, { data: compliance }, { data: shifts }, { data: subs }, { data: recent }, { data: week }] = await Promise.all([
    supabase.from('memberships').select('id,display_name,callsign,rank_name,status,duty_status,duty_changed_at,leave_until,is_probationary,created_at')
      .eq('department_key', dept.key).in('status', ['active', 'suspended', 'pending']).returns<Membership[]>(),
    supabase.rpc('department_compliance', { p_department: dept.key }),
    supabase.from('shift_logs').select('id,department_key,required_tier,profile_id').eq('department_key', dept.key).in('status', ['submitted', 'under_review']).returns<Open[]>(),
    supabase.from('submissions').select('id,department_key,required_tier,profile_id,kind,status,expires_at').eq('department_key', dept.key)
      .in('status', ['submitted', 'under_review', 'approved']).returns<(Open & Pick<Submission, 'kind' | 'status' | 'expires_at'>)[]>(),
    supabase.from('approval_actions').select('*').eq('department_key', dept.key).order('created_at', { ascending: false }).limit(12).returns<ApprovalAction[]>(),
    supabase.from('submissions').select('kind').eq('department_key', dept.key).gte('submitted_at', weekAgo).returns<{ kind: string }[]>(),
  ]);

  const all = members ?? [];
  const active = all.filter((m) => m.status === 'active');
  const onDuty = active.filter((m) => m.duty_status === 'on_duty');
  const pendingJoin = all.filter((m) => m.status === 'pending');
  const today = new Date().toISOString().slice(0, 10);
  const onLeave = active.filter((m) => m.leave_until && m.leave_until >= today);
  const probation = active.filter((m) => m.is_probationary);
  const rows = (compliance ?? []) as ComplianceRow[];
  const weekMinutes = rows.reduce((n, r) => n + r.approved_minutes, 0);
  const pendingMinutes = rows.reduce((n, r) => n + r.pending_minutes, 0);
  const below = rows.filter((r) => !r.on_leave && r.approved_minutes < r.quota_minutes);
  const myQueue = [...(shifts ?? []), ...(subs ?? []).filter((x) => x.status !== 'approved')]
    .filter((x) => canDecide(s, x.department_key, x.required_tier, x.profile_id)).length;
  const now = new Date();
  const alerts = (subs ?? []).filter((x) => ['warrant', 'bolo'].includes(x.kind) && x.status === 'approved' && x.expires_at && new Date(x.expires_at) > now).length;
  const byKind = Object.entries((week ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]);
  const quota = rows[0]?.quota_minutes ?? 0;

  const tiles = [
    { label: 'Active members', value: active.length, sub: `${probation.length} probationary · ${onLeave.length} on leave`, href: `/hub/roster?dept=${dept.key}` },
    { label: 'On duty now', value: onDuty.length, sub: onDuty.length ? onDuty.slice(0, 3).map((m) => m.callsign ?? m.display_name).join(', ') : 'Nobody clocked in', href: '/hub/board', live: onDuty.length > 0 },
    { label: 'Hours this week', value: hours(weekMinutes), sub: `${hours(pendingMinutes)} still pending review` },
    { label: 'Below quota', value: below.length, sub: quota ? `Quota ${hours(quota)} a week · a flag, not a strike` : 'No quota set', warn: below.length > 0 },
    { label: 'Waiting for you', value: myQueue, sub: 'Shift logs, reports and requests', href: '/hub/approvals', gold: myQueue > 0 },
    { label: 'Join requests', value: pendingJoin.length, sub: pendingJoin.length ? `Oldest ${relative(pendingJoin.sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at)}` : 'None waiting', href: s.canManageRoster(dept.key) ? `/hub/command/staff?dept=${dept.key}` : `/hub/roster?dept=${dept.key}`, gold: pendingJoin.length > 0 && s.canManageRoster(dept.key) },
  ];

  return (
    <>
      <PageHead eyebrow={dept.name} title="Supervisor panel" />
      <PanelTabs s={s} panel="supervisor" dept={dept} depts={depts} />

      <section className="card relative mb-4 flex items-center gap-5 overflow-hidden p-5" style={{ '--accent': dept.accent } as React.CSSProperties}>
        <div className="accent-line absolute inset-x-0 top-0" />
        <Emblem dept={dept.key} label={dept.short_name} accent={dept.accent} division={dept.division} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-medium">{dept.name}</div>
          <div className="text-[13px] text-muted">{alerts ? `${alerts} active warrant${alerts === 1 ? '' : 's'} and BOLOs · ` : ''}{(week ?? []).length} reports and requests filed in the last 7 days</div>
        </div>
        <Link href={`/hub/records?dept=${dept.key}`} className="btn btn-sm hidden sm:inline-flex">All records</Link>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => {
          const body = (
            <>
              <div className="label flex items-center gap-2">
                {t.live && <span className="on-duty-ring h-2 w-2 rounded-full bg-ok" />}{t.label}
              </div>
              <div className={`mt-3 text-[30px] font-semibold tracking-tight ${t.gold ? 'text-gold' : t.warn ? 'text-warn' : ''}`}>{t.value}</div>
              <div className="mt-1 truncate text-[13px] text-muted">{t.sub}</div>
            </>
          );
          return t.href
            ? <Link key={t.label} href={t.href} className={`card p-5 ${t.gold ? 'border-gold/30' : ''}`}>{body}</Link>
            : <div key={t.label} className="card card-hover p-5">{body}</div>;
        })}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="label mb-4">Activity this week</h2>
          {rows.length ? (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Member</th><th className="w-[40%]">Approved vs quota</th><th>Pending</th></tr></thead>
                <tbody>
                  {[...rows].sort((a, b) => b.approved_minutes - a.approved_minutes).map((r) => {
                    const pct = r.quota_minutes ? Math.min(100, Math.round((r.approved_minutes / r.quota_minutes) * 100)) : 100;
                    const met = r.approved_minutes >= r.quota_minutes;
                    return (
                      <tr key={r.membership_id}>
                        <td>
                          <Link href={`/hub/roster/${r.membership_id}`} className="hover:text-gold">
                            {r.callsign && <span className="mr-2 font-mono text-[12px] text-muted">{r.callsign}</span>}{r.display_name}
                          </Link>
                          <div className="text-[12px] text-faint">{r.rank_name}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <div className={`h-full rounded-full ${r.on_leave ? 'bg-faint' : met ? 'bg-ok' : 'bg-warn'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-16 text-right text-[13px]">{r.on_leave ? 'LOA' : hours(r.approved_minutes)}</span>
                          </div>
                        </td>
                        <td className="text-muted">{hours(r.pending_minutes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty>No active members yet.</Empty>}
          <p className="mt-3 text-[12px] text-faint">The hub never issues strikes. Use this to check in with members.</p>
        </section>

        <div className="grid content-start gap-10">
          <section>
            <h2 className="label mb-4">Filed in the last 7 days</h2>
            {byKind.length ? (
              <div className="card divide-y divide-line">
                {byKind.map(([k, n]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-3 text-[14px]">
                    <span>{KIND[k]?.label ?? k}</span><span className="font-medium">{n}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>Nothing filed this week.</Empty>}
          </section>

          <section>
            <h2 className="label mb-4">Recent decisions</h2>
            {recent?.length ? (
              <ol className="card divide-y divide-line">
                {recent.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-[13px]">
                    <span className="font-medium capitalize">{a.action}</span>
                    <span className="text-muted"> · {a.record_type.replace('_', ' ')} · {a.actor_name}</span>
                    <div className="text-[12px] text-faint">{relative(a.created_at)}{a.reason ? ` · “${a.reason.slice(0, 80)}”` : ''}</div>
                  </li>
                ))}
              </ol>
            ) : <Empty>No decisions yet.</Empty>}
          </section>
        </div>
      </div>
    </>
  );
}
