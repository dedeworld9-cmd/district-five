import Link from 'next/link';
import { Empty, Flash, Stat, StatusTag } from '@/components/ui';
import { ACTIVITY_LABEL, dateOnly, dateTime, duration, greeting, hours, relative, todayLabel } from '@/lib/format';
import { canDecide } from '@/lib/queue';
import { requireSession, tzOf, type Session } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ActivityRow, Announcement, ComplianceRow, ShiftLog, Tier } from '@/lib/types';
import { requestMembership, setActiveDepartment, setDuty } from './actions';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.current) return <NotOnRoster s={s} sp={sp} />;

  const supabase = await createClient();
  const dept = s.current.department_key;
  const tz = tzOf(s);
  const supervising = s.canSupervise(dept) && s.currentDept?.kind === 'department';

  const [{ data: activity }, { data: mode }, { data: recent }, { data: news }, { data: open }, { data: compliance }] = await Promise.all([
    supabase.rpc('my_activity', { p_weeks: 4 }),
    supabase.from('app_settings').select('value').eq('key', 'dual_membership_mode').maybeSingle<{ value: string }>(),
    supabase.from('shift_logs').select('*').eq('profile_id', s.userId).order('started_at', { ascending: false }).limit(5).returns<ShiftLog[]>(),
    supabase.from('announcements').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(4).returns<Announcement[]>(),
    s.supervised.length || s.isDps
      ? supabase.from('shift_logs').select('id,department_key,required_tier,profile_id').in('status', ['submitted', 'under_review'])
      : Promise.resolve({ data: [] as { id: string; department_key: string; required_tier: Tier; profile_id: string }[] }),
    supervising ? supabase.rpc('department_compliance', { p_department: dept }) : Promise.resolve({ data: null }),
  ]);

  const rows = (activity ?? []) as ActivityRow[];
  const weeks = [...new Set(rows.map((r) => r.week_start))].sort().reverse();
  const thisWeek = rows.filter((r) => r.week_start === weeks[0]);
  const combined = (mode?.value ?? 'combined') === 'combined';
  const scoped = combined ? thisWeek : thisWeek.filter((r) => r.department_key === dept);
  const approved = scoped.reduce((n, r) => n + r.approved_minutes, 0);
  const pending = scoped.reduce((n, r) => n + r.pending_minutes, 0);
  const returned = thisWeek.reduce((n, r) => n + r.returned_count, 0);
  const quota = Math.max(0, ...scoped.map((r) => r.quota_minutes));
  const exempt = scoped.length > 0 && scoped.every((r) => r.exempt);
  const fourWeeks = rows.filter((r) => combined || r.department_key === dept).reduce((n, r) => n + r.approved_minutes, 0);
  const queue = (open ?? []).filter((l) => canDecide(s, l.department_key, l.required_tier, l.profile_id)).length;
  const below = ((compliance ?? []) as ComplianceRow[]).filter((c) => !c.on_leave && (combined ? c.district_minutes : c.approved_minutes) < c.quota_minutes);
  const deptLabel = (k: string) => s.departments.find((d) => d.key === k)?.short_name ?? k.toUpperCase();
  const pct = quota ? Math.min(100, Math.round((approved / quota) * 100)) : 100;
  const onDuty = s.current.duty_status === 'on_duty';
  const multi = s.active.filter((m) => s.departments.find((d) => d.key === m.department_key)?.kind === 'department').length > 1;

  return (
    <>
      <Flash searchParams={sp} />
      <section className="mb-10">
        <div className="label mb-4 flex items-center gap-2"><span className="gold-dot" />{s.currentDept?.short_name} · {todayLabel(tz)}</div>
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight sm:text-[44px]">
          {greeting(tz)}, {s.profile.display_name.split(' ')[0]}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {[s.current.rank_name, s.current.callsign, s.current.badge && `#${s.current.badge}`].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {s.currentDept?.kind === 'department' && <Link href="/hub/shifts/new" className="btn-primary">Log a shift</Link>}
          {queue > 0 && <Link href="/hub/approvals" className="btn">Review {queue} waiting</Link>}
          {s.active.length > 1 && (
            <form action={setActiveDepartment} className="flex gap-1 md:hidden">
              <input type="hidden" name="back" value="/hub" />
              {s.active.filter((m) => m.department_key !== dept).map((m) => (
                <button key={m.id} name="department" value={m.department_key} className="btn">Switch to {deptLabel(m.department_key)}</button>
              ))}
            </form>
          )}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
        {s.currentDept?.kind === 'department' ? (
          <div className="card flex flex-col justify-between p-6">
            <div>
              <div className="label">Duty status</div>
              <div className="mt-3 flex items-center gap-2.5 text-[24px] font-semibold tracking-tight">
                <span className={`h-2.5 w-2.5 rounded-full ${onDuty ? 'bg-ok' : 'bg-faint'}`} />
                {onDuty ? 'On duty' : 'Off duty'}
              </div>
              <p className="mt-1.5 text-[13px] text-muted">
                {onDuty && s.current.duty_changed_at
                  ? `Since ${dateTime(s.current.duty_changed_at, tz)}. Clocking out opens a shift log with these times filled in.`
                  : `Clock in when you start patrol in ${s.currentDept.short_name}.`}
              </p>
            </div>
            <form action={setDuty} className="mt-6">
              <input type="hidden" name="department" value={dept} />
              <input type="hidden" name="status" value={onDuty ? 'off_duty' : 'on_duty'} />
              {onDuty && s.current.duty_changed_at && <input type="hidden" name="since" value={s.current.duty_changed_at} />}
              <button className={onDuty ? 'btn w-full' : 'btn-primary w-full'}>{onDuty ? 'Clock out' : 'Clock in'}</button>
            </form>
          </div>
        ) : (
          <div className="card p-6">
            <div className="label">District oversight</div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              DPS sees both departments. Department heads&apos; shift logs and anything escalated land in your queue.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat gold label="This week" value={hours(approved)} sub={exempt ? 'On leave, quota paused' : `of ${hours(quota)} quota${combined && multi ? ', combined' : ''}`}>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
          </Stat>
          <Stat label="Pending review" value={hours(pending)} sub="Not yet counted" />
          <Stat label="Returned" value={returned} sub={returned ? <Link href="/hub/shifts?status=returned" className="text-warn">Needs your correction</Link> : 'Nothing to fix'} />
          {supervising
            ? <Stat label="Below quota" value={below.length} sub={`${deptLabel(dept)} this week · a flag, not a strike`} />
            : <Stat label="Last 4 weeks" value={hours(fourWeeks)} sub="Approved time" />}
        </div>
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="label">Announcements</h2>
            <Link href="/hub/announcements" className="text-[13px] text-muted hover:text-ink">All</Link>
          </div>
          {news?.length ? (
            <ul className="grid gap-2">
              {news.map((a) => (
                <li key={a.id} className="card p-4">
                  <div className="flex items-center gap-2 text-[12px] text-faint">
                    <span>{a.scope === 'district' ? 'District' : deptLabel(a.department_key ?? '')}</span>
                    <span>·</span>
                    <span>{a.published_at ? relative(a.published_at) : ''}</span>
                    {a.priority !== 'normal' && <span className="tag tag-gold">{a.priority}</span>}
                  </div>
                  <div className="mt-1.5 text-[15px] font-medium">{a.title}</div>
                  <p className="mt-1 line-clamp-2 text-[14px] text-muted">{a.body}</p>
                </li>
              ))}
            </ul>
          ) : <Empty>No announcements yet.</Empty>}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="label">Your recent shifts</h2>
            <Link href="/hub/shifts" className="text-[13px] text-muted hover:text-ink">All</Link>
          </div>
          {recent?.length ? (
            <ul className="card divide-y divide-line">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link href={`/hub/shifts/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/[0.02]">
                    <div className="min-w-0">
                      <div className="text-[14px]">{ACTIVITY_LABEL[l.activity_type]} · {duration(l.duration_minutes)}</div>
                      <div className="text-[12px] text-faint">{deptLabel(l.department_key)} · {dateOnly(l.started_at, tzOf(s, l.department_key))}</div>
                    </div>
                    <StatusTag status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>No shifts logged yet. Clock in, or log a past shift.</Empty>}
        </div>
      </section>

      {supervising && below.length > 0 && (
        <section className="mt-12">
          <h2 className="label mb-4">Below quota this week · {deptLabel(dept)}</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Member</th><th>Rank</th><th>Approved</th><th>Pending</th>{combined && <th>District total</th>}</tr></thead>
              <tbody>
                {below.map((c) => (
                  <tr key={c.membership_id}>
                    <td><Link href={`/hub/roster/${c.membership_id}`} className="hover:text-gold">{c.callsign ? `${c.callsign} · ` : ''}{c.display_name}</Link></td>
                    <td className="text-muted">{c.rank_name}</td>
                    <td>{hours(c.approved_minutes)}</td>
                    <td className="text-muted">{hours(c.pending_minutes)}</td>
                    {combined && <td className="text-muted">{hours(c.district_minutes)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-faint">The hub never issues strikes. Use this list to check in with members.</p>
        </section>
      )}
    </>
  );
}

function NotOnRoster({ s, sp }: { s: Session; sp: Record<string, string | undefined> }) {
  const suspended = s.mine.filter((m) => m.status === 'suspended');
  const pending = s.mine.filter((m) => m.status === 'pending');
  const taken = new Set(s.mine.filter((m) => ['pending', 'active', 'suspended'].includes(m.status)).map((m) => m.department_key));
  const joinable = s.departments.filter((d) => d.kind === 'department' && !taken.has(d.key));
  const name = (k: string) => s.departments.find((d) => d.key === k)?.name ?? k;
  return (
    <div className="max-w-xl">
      <Flash searchParams={sp} />
      <div className="label mb-4 flex items-center gap-2"><span className="gold-dot" />Welcome</div>
      <h1 className="text-[34px] font-semibold tracking-tight">Hello, {s.profile.display_name.split(' ')[0]}</h1>
      {suspended.map((m) => (
        <p key={m.id} className="mt-6 rounded-xl border border-warn/30 px-4 py-3 text-[14px] text-warn">
          Your {name(m.department_key)} membership is suspended. Contact your command staff.
        </p>
      ))}
      {pending.map((m) => (
        <p key={m.id} className="mt-6 card px-4 py-3 text-[14px] text-muted">
          Your request to join {name(m.department_key)} is waiting for command review. Sent {dateOnly(m.created_at)}.
        </p>
      ))}
      {joinable.length > 0 && (
        <form action={requestMembership} className="card mt-8 grid gap-4 p-6">
          <div>
            <div className="text-[16px] font-medium">Request to join a department</div>
            <p className="mt-1 text-[13px] text-muted">If you are already on a roster, command can link your Discord account instead.</p>
          </div>
          <label className="field"><span>Department</span>
            <select name="department" className="input" required>
              {joinable.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Note for command (optional)</span>
            <textarea name="note" className="input" maxLength={600} placeholder="Character name, who recruited you, transfer details" />
          </label>
          <div><button className="btn-primary">Send request</button></div>
        </form>
      )}
      {s.isAdmin && <p className="mt-8 text-[14px] text-muted">You are a technical administrator. <Link href="/hub/admin" className="text-gold">Open Admin</Link></p>}
    </div>
  );
}
