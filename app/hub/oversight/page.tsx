import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Emblem } from '@/components/Emblem';
import { Empty, PageHead } from '@/components/ui';
import { DIVISION_LABEL, hours, relative } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ApprovalAction, ComplianceRow, Membership } from '@/lib/types';

export const metadata = { title: 'Oversight panel' };

type Open = { department_key: string; kind?: string };

// Division command's view across every department it oversees: staffing, activity and open work,
// with a way into each department's own panels.
export default async function Oversight({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const commands = s.active.map((m) => s.departments.find((d) => d.key === m.department_key)).filter((d) => d?.kind === 'oversight').map((d) => d!);
  const cmd = commands.find((d) => d.key === sp.dept) ?? commands.find((d) => d.key === s.current?.department_key) ?? commands[0];
  if (!cmd) redirect('/hub');
  const depts = s.departments.filter((d) => d.kind === 'department' && d.active && cmd.oversees.includes(d.division));
  const keys = depts.map((d) => d.key);
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: members }, { data: shifts }, { data: subs }, { data: week }, { data: recent }, { data: staff }, ...compliance] = await Promise.all([
    supabase.from('memberships').select('id,department_key,status,duty_status,leave_until,is_probationary').in('department_key', keys)
      .in('status', ['active', 'suspended', 'pending']).returns<Membership[]>(),
    supabase.from('shift_logs').select('department_key').in('department_key', keys).in('status', ['submitted', 'under_review']).returns<Open[]>(),
    supabase.from('submissions').select('department_key,kind').in('department_key', keys).in('status', ['submitted', 'under_review']).returns<Open[]>(),
    supabase.from('submissions').select('department_key,kind').in('department_key', keys).gte('submitted_at', weekAgo).returns<Open[]>(),
    supabase.from('approval_actions').select('*').in('department_key', keys).order('created_at', { ascending: false }).limit(10).returns<ApprovalAction[]>(),
    supabase.from('memberships').select('id,display_name,callsign,rank_name,duty_status').eq('department_key', cmd.key).eq('status', 'active')
      .returns<Membership[]>(),
    ...keys.map((k) => supabase.rpc('department_compliance', { p_department: k })),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const cards = depts.map((d, i) => {
    const mine = (members ?? []).filter((m) => m.department_key === d.key);
    const active = mine.filter((m) => m.status === 'active');
    const rows = (compliance[i]?.data ?? []) as ComplianceRow[];
    return {
      d,
      active: active.length,
      onDuty: active.filter((m) => m.duty_status === 'on_duty').length,
      leave: active.filter((m) => m.leave_until && m.leave_until >= today).length,
      pendingJoin: mine.filter((m) => m.status === 'pending').length,
      suspended: mine.filter((m) => m.status === 'suspended').length,
      queue: (shifts ?? []).filter((x) => x.department_key === d.key).length + (subs ?? []).filter((x) => x.department_key === d.key).length,
      filed: (week ?? []).filter((x) => x.department_key === d.key).length,
      hours: rows.reduce((n, r) => n + r.approved_minutes, 0),
      below: rows.filter((r) => !r.on_leave && r.approved_minutes < r.quota_minutes).length,
    };
  });
  const total = (k: 'active' | 'onDuty' | 'queue' | 'filed') => cards.reduce((n, c) => n + c[k], 0);
  // Serious records that reach division command: use of force and officer-involved shootings.
  const serious = (subs ?? []).filter((x) => ['use_of_force', 'ois'].includes(x.kind ?? '')).length;
  const short = (k: string | null) => s.departments.find((d) => d.key === k)?.short_name ?? k;

  return (
    <>
      <PageHead eyebrow={cmd.name} title="Oversight panel">
        {commands.length > 1 && (
          <div className="flex gap-1">
            {commands.map((c) => (
              <Link key={c.key} href={`/hub/oversight?dept=${c.key}`}
                className={`rounded-full px-3 py-1.5 text-[13px] ${c.key === cmd.key ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{c.short_name}</Link>
            ))}
          </div>
        )}
      </PageHead>
      <p className="-mt-4 mb-8 max-w-2xl text-[14px] text-muted">
        {cmd.short_name} oversees {cmd.oversees.map((v) => (v === 'fire_ems' ? 'Fire & EMS' : DIVISION_LABEL[v].toLowerCase())).join(', ').replace(/, ([^,]*)$/, ' and $1')}.
        Open any department to use its supervisor, command staff and administration panels.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Members', value: total('active') },
          { label: 'On duty now', value: total('onDuty') },
          { label: 'Waiting for review', value: total('queue'), gold: total('queue') > 0 },
          { label: 'Use of force & OIS', value: serious, warn: serious > 0 },
          { label: 'Filed this week', value: total('filed') },
        ].map((t) => (
          <div key={t.label} className="card p-5">
            <div className="label">{t.label}</div>
            <div className={`mt-3 text-[28px] font-semibold tracking-tight ${t.gold ? 'text-gold' : t.warn ? 'text-warn' : ''}`}>{t.value}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="label mb-3">Departments</h2>
        {cards.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {cards.map((c) => (
              <div key={c.d.key} className="card relative overflow-hidden p-5" style={{ '--accent': c.d.accent } as React.CSSProperties}>
                <div className="accent-line absolute inset-x-0 top-0" />
                <div className="flex items-center gap-3">
                  <Emblem dept={c.d.key} label={c.d.short_name} accent={c.d.accent} division={c.d.division} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium">{c.d.name}</div>
                    <div className="text-[12px] text-faint">{DIVISION_LABEL[c.d.division]}</div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px] sm:grid-cols-6">
                  {[
                    ['Members', c.active], ['On duty', c.onDuty], ['To review', c.queue],
                    ['Hours (wk)', hours(c.hours)], ['Below quota', c.below], ['Join requests', c.pendingJoin],
                  ].map(([k, v]) => (
                    <div key={k as string}><dt className="text-[11px] text-faint">{k}</dt><dd className="mt-0.5 text-[16px] font-medium">{v}</dd></div>
                  ))}
                </dl>
                {(c.leave > 0 || c.suspended > 0) && (
                  <p className="mt-3 text-[12px] text-muted">{[c.leave && `${c.leave} on leave`, c.suspended && `${c.suspended} suspended`].filter(Boolean).join(' · ')}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Link href={`/hub/command?dept=${c.d.key}`} className="btn btn-sm">Supervisor</Link>
                  <Link href={`/hub/command/staff?dept=${c.d.key}`} className="btn btn-sm">Command staff</Link>
                  <Link href={`/hub/command/admin?dept=${c.d.key}`} className="btn btn-sm">Administration</Link>
                  <Link href={`/hub/roster?dept=${c.d.key}`} className="btn btn-sm">Roster</Link>
                  <Link href={`/hub/records?dept=${c.d.key}`} className="btn btn-sm">Records</Link>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>No departments under {cmd.short_name} yet.</Empty>}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="label mb-3">{cmd.short_name} staff · {(staff ?? []).length}</h2>
          {staff?.length ? (
            <div className="card divide-y divide-line">
              {staff.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
                  <span>{m.callsign && <span className="mr-2 font-mono text-[12px] text-gold">{m.callsign}</span>}{m.display_name}
                    <span className="ml-2 text-[12px] text-faint">{m.rank_name}</span></span>
                  {m.duty_status === 'on_duty' && <span className="tag tag-ok">On duty</span>}
                </div>
              ))}
            </div>
          ) : <Empty>Nobody on the {cmd.short_name} roster yet.</Empty>}
        </section>
        <section>
          <h2 className="label mb-3">Recent decisions</h2>
          {recent?.length ? (
            <ol className="card divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="px-4 py-3 text-[13px]">
                  <span className="font-medium capitalize">{a.action}</span>
                  <span className="text-muted"> · {short(a.department_key)} · {a.record_type.replace('_', ' ')} · {a.actor_name}</span>
                  <div className="text-[12px] text-faint">{relative(a.created_at)}{a.reason ? ` · “${a.reason.slice(0, 80)}”` : ''}</div>
                </li>
              ))}
            </ol>
          ) : <Empty>No decisions yet.</Empty>}
        </section>
      </div>
    </>
  );
}
