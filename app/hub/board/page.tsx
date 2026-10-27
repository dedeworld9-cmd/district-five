import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Empty, PageHead } from '@/components/ui';
import { DIVISION_LABEL, dateTime, hours, relative } from '@/lib/format';
import { requireSession, tzOf } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Membership, Submission } from '@/lib/types';

export const metadata = { title: 'Board' };

type Leader = { display_name: string; callsign: string | null; rank_name: string | null; minutes: number };

export default async function Board({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.active.length) redirect('/hub');
  const supabase = await createClient();

  const myDepts = s.active.map((m) => s.departments.find((d) => d.key === m.department_key))
    .filter((d) => d?.kind === 'department').map((d) => d!);
  const dept = myDepts.find((d) => d.key === sp.dept) ?? myDepts.find((d) => d.key === s.current?.department_key) ?? myDepts[0];
  const tz = tzOf(s, dept?.key);

  const [{ data: onDuty }, { data: alerts }, board] = await Promise.all([
    supabase.from('memberships').select('id,display_name,callsign,rank_name,department_key,duty_changed_at')
      .eq('duty_status', 'on_duty').eq('status', 'active').order('callsign', { nullsFirst: false })
      .returns<Pick<Membership, 'id' | 'display_name' | 'callsign' | 'rank_name' | 'department_key' | 'duty_changed_at'>[]>(),
    supabase.from('submissions').select('*').in('kind', ['warrant', 'bolo']).eq('status', 'approved')
      .gt('expires_at', new Date().toISOString()).order('expires_at').returns<Submission[]>(),
    dept ? supabase.rpc('weekly_leaderboard', { p_department: dept.key, p_limit: 10 }) : Promise.resolve({ data: [] }),
  ]);
  const leaders = (board.data ?? []) as Leader[];

  // On-duty units, grouped by department and ordered by division.
  const order = ['leo', 'fire_ems', 'dispatch'];
  const units = s.departments.filter((d) => d.kind === 'department')
    .sort((a, b) => order.indexOf(a.division) - order.indexOf(b.division))
    .map((d) => ({ d, list: (onDuty ?? []).filter((m) => m.department_key === d.key) }))
    .filter((g) => g.list.length);
  const short = (k: string) => s.departments.find((d) => d.key === k)?.short_name ?? k;
  const warrants = (alerts ?? []).filter((a) => a.kind === 'warrant');
  const bolos = (alerts ?? []).filter((a) => a.kind === 'bolo');
  const leo = myDepts.some((d) => d.division === 'leo');

  return (
    <>
      <PageHead eyebrow="Right now" title="Board" />

      <div className="grid gap-10">
        <section>
          <h2 className="label mb-3">On duty · {(onDuty ?? []).length}</h2>
          {units.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {units.map(({ d, list }) => (
                <div key={d.key} className="card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-medium">{d.short_name}</span>
                    <span className="text-[12px] text-faint">{DIVISION_LABEL[d.division]}</span>
                  </div>
                  <ul className="mt-3 grid gap-2 text-[14px]">
                    {list.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
                          {m.callsign && <span className="font-mono text-[13px] text-gold">{m.callsign}</span>}
                          {m.display_name}
                        </span>
                        {m.duty_changed_at && <span className="text-[12px] text-faint">{relative(m.duty_changed_at)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : <Empty>Nobody is clocked in.</Empty>}
        </section>

        {leo && (
          <div className="grid gap-10 lg:grid-cols-2">
            {([['Active warrants', warrants], ['Active BOLOs', bolos]] as const).map(([label, list]) => (
              <section key={label}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="label">{label} · {list.length}</h2>
                  <Link href={`/hub/reports/new?kind=${label === 'Active warrants' ? 'warrant' : 'bolo'}`} className="text-[13px] text-gold">Request one</Link>
                </div>
                {list.length ? (
                  <div className="card divide-y divide-line">
                    {list.map((a) => (
                      <Link key={a.id} href={`/hub/reports/${a.id}`} className="block px-4 py-3 hover:bg-white/[0.02]">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[14px] font-medium">{a.title}</span>
                          <span className="shrink-0 text-[12px] text-faint">{short(a.department_key)}</span>
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[13px] text-muted">
                          {a.kind === 'warrant' ? a.details.charges : a.details.reason}
                        </div>
                        <div className="mt-1 text-[12px] text-faint">Expires {dateTime(a.expires_at!, tzOf(s, a.department_key))}</div>
                      </Link>
                    ))}
                  </div>
                ) : <Empty>None active.</Empty>}
              </section>
            ))}
          </div>
        )}

        {dept && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="label">Hours this week · {dept.short_name}</h2>
              {myDepts.length > 1 && (
                <div className="flex gap-1">
                  {myDepts.map((d) => (
                    <Link key={d.key} href={`/hub/board?dept=${d.key}`}
                      className={`rounded-full px-3 py-1 text-[12px] ${d.key === dept.key ? 'bg-white/[0.08]' : 'text-muted'}`}>{d.short_name}</Link>
                  ))}
                </div>
              )}
            </div>
            {leaders.length ? (
              <ol className="card divide-y divide-line">
                {leaders.map((l, i) => (
                  <li key={`${l.display_name}-${i}`} className="flex items-center gap-4 px-4 py-3 text-[14px]">
                    <span className={`w-5 text-right font-mono text-[13px] ${i < 3 ? 'text-gold' : 'text-faint'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {l.callsign && <span className="mr-2 font-mono text-[13px] text-muted">{l.callsign}</span>}
                      {l.display_name}
                      {l.rank_name && <span className="ml-2 text-[12px] text-faint">{l.rank_name}</span>}
                    </span>
                    <span className="font-medium">{hours(l.minutes)}</span>
                  </li>
                ))}
              </ol>
            ) : <Empty>No hours logged yet this week.</Empty>}
            <p className="mt-2 text-[12px] text-faint">Counts submitted and approved shift logs. The week runs on {tz.replace('_', ' ')} time.</p>
          </section>
        )}
      </div>
    </>
  );
}
