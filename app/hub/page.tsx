import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Empty, Flash, Stat, StatusTag } from '@/components/ui';
import { ACTIVITY_LABEL, dateOnly, dateTime, duration, greeting, hours, relative, todayLabel } from '@/lib/format';
import { canDecide } from '@/lib/queue';
import { requireSession, tzOf, type Session } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ActivityRow, Announcement, ShiftLog, Tier } from '@/lib/types';
import { Emblem } from '@/components/Emblem';
import { ShiftClock } from '@/components/ShiftClock';
import { JoinForm } from '@/components/JoinForm';
import { PHOTOS } from '@/lib/brand';
import { setActiveDepartment, setDuty } from './actions';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.current) return <NotOnRoster s={s} sp={sp} />;
  if (s.currentDept?.kind === 'oversight') redirect('/hub/patrol');

  const supabase = await createClient();
  const dept = s.current.department_key;
  const tz = tzOf(s);

  const [{ data: activity }, { data: mode }, { data: recent }, { data: news }, { data: open }] = await Promise.all([
    supabase.rpc('my_activity', { p_weeks: 4 }),
    supabase.from('app_settings').select('value').eq('key', 'dual_membership_mode').maybeSingle<{ value: string }>(),
    supabase.from('shift_logs').select('*').eq('profile_id', s.userId).eq('department_key', dept).order('started_at', { ascending: false }).limit(5).returns<ShiftLog[]>(),
    supabase.from('announcements').select('*').eq('status', 'published').eq('department_key', dept).order('published_at', { ascending: false }).limit(4).returns<Announcement[]>(),
    s.supervised.length || s.isDps
      ? supabase.from('shift_logs').select('id,department_key,required_tier,profile_id').in('status', ['submitted', 'under_review'])
      : Promise.resolve({ data: [] as { id: string; department_key: string; required_tier: Tier; profile_id: string }[] }),
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
  const deptLabel = (k: string) => s.departments.find((d) => d.key === k)?.short_name ?? k.toUpperCase();
  const pct = quota ? Math.min(100, Math.round((approved / quota) * 100)) : 100;
  const onDuty = s.current.duty_status === 'on_duty';
  const multi = s.active.filter((m) => s.departments.find((d) => d.key === m.department_key)?.kind === 'department').length > 1;

  return (
    <>
      <Flash searchParams={sp} />
      <section className="card relative mb-4 overflow-hidden p-6 sm:p-8">
        {PHOTOS[dept] && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTOS[dept]} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-40 sm:w-[65%]" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--color-surface) 25%, rgb(13 17 24 / 0.85) 55%, rgb(13 17 24 / 0.35))' }} />
          </>
        )}
        <div className="accent-line absolute inset-x-0 top-0" />
        <div className="absolute -top-28 -left-28 h-64 w-64 rounded-full opacity-[0.12] blur-3xl" style={{ background: 'var(--accent)' }} />
        <div className="relative flex flex-wrap items-center gap-6">
          {s.currentDept && (
            <Emblem dept={dept} label={s.currentDept.short_name} accent={s.currentDept.accent} division={s.currentDept.division} size={76} />
          )}
          <div className="min-w-0 flex-1">
            <div className="label flex items-center gap-2"><span className="gold-dot" />{s.currentDept?.name} · {todayLabel(tz)}</div>
            <h1 className="wordmark mt-2 text-[32px] leading-tight font-semibold tracking-tight sm:text-[42px]">
              {greeting(tz)}, {s.profile.display_name.split(' ')[0]}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-muted">
              {s.current.callsign && <span className="rounded-md border border-line-strong bg-bg/50 px-2 py-0.5 font-mono text-[12px] text-ink">{s.current.callsign}</span>}
              {[s.current.rank_name, s.current.badge && `#${s.current.badge}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/hub/shifts/new" className="btn bg-bg/40 backdrop-blur">Log a past shift</Link>
            {s.currentDept && <Link href="/hub/reports" className="btn bg-bg/40 backdrop-blur">File a report</Link>}
            {queue > 0 && <Link href="/hub/approvals" className="btn bg-bg/40 backdrop-blur">Review {queue} waiting</Link>}
            {s.active.length > 1 && (
              <form action={setActiveDepartment} className="flex gap-1 md:hidden">
                <input type="hidden" name="back" value="/hub" />
                {s.active.filter((m) => m.department_key !== dept).map((m) => (
                  <button key={m.id} name="department" value={m.department_key} className="btn">Switch to {deptLabel(m.department_key)}</button>
                ))}
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
        <div className={`card relative flex flex-col justify-between overflow-hidden p-6 ${onDuty ? 'border-ok/40' : ''}`}>
          {onDuty && <div className="absolute -top-20 -right-20 h-44 w-44 rounded-full bg-ok/20 blur-3xl" />}
          <div className="relative">
            <div className="label flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${onDuty ? 'on-duty-ring bg-ok' : 'bg-faint'}`} />
              {onDuty ? `On shift · ${s.currentDept?.short_name}` : 'Off duty'}
            </div>
            {onDuty && s.current.duty_changed_at ? (
              <>
                <ShiftClock since={s.current.duty_changed_at} className="mt-3 block font-mono text-[40px] leading-none font-semibold tracking-tight text-ok" />
                <p className="mt-2 text-[13px] text-muted">Started {dateTime(s.current.duty_changed_at, tz)}. When you end it, your shift log opens with the times filled in.</p>
              </>
            ) : (
              <>
                <div className="mt-3 text-[24px] font-semibold tracking-tight">Ready to go on duty?</div>
                <p className="mt-1.5 text-[13px] text-muted">Start your shift when you load in. The timer runs until you end it.</p>
              </>
            )}
          </div>
          <form action={setDuty} className="relative mt-6">
            <input type="hidden" name="department" value={dept} />
            <input type="hidden" name="status" value={onDuty ? 'off_duty' : 'on_duty'} />
            {onDuty && s.current.duty_changed_at && <input type="hidden" name="since" value={s.current.duty_changed_at} />}
            <button className={`${onDuty ? 'btn' : 'btn-primary'} h-12 w-full text-[15px]`}>{onDuty ? 'End shift and write the log' : 'Start shift'}</button>
          </form>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat gold label="This week" value={hours(approved)} sub={exempt ? 'On leave, quota paused' : `of ${hours(quota)} quota${combined && multi ? ', combined' : ''}`}>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold shadow-[0_0_12px_rgb(207_174_90/0.6)]" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgb(207 174 90 / 0.6), #cfae5a)' }} />
            </div>
          </Stat>
          <Stat label="Pending review" value={hours(pending)} sub="Not yet counted" />
          <Stat label="Returned" value={returned} sub={returned ? <Link href="/hub/shifts?status=returned" className="text-warn">Needs your correction</Link> : 'Nothing to fix'} />
          <Stat label="Last 4 weeks" value={hours(fourWeeks)} sub="Approved time" />
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
          ) : <Empty>No shifts logged yet. Start a shift, or log a past one.</Empty>}
        </div>
      </section>

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
        <div className="mt-8"><JoinForm joinable={joinable} preselect={sp.join} name={s.profile.display_name} back="/hub" /></div>
      )}
      {s.isAdmin && <p className="mt-8 text-[14px] text-muted">You are an administrator. To use shifts, reports, approvals and the board, <Link href="/hub/admin" className="text-gold">put yourself on a roster from Admin</Link>.</p>}
    </div>
  );
}
