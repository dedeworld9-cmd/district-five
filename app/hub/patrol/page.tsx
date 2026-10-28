import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Emblem } from '@/components/Emblem';
import { ShiftClock } from '@/components/ShiftClock';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { PHOTOS } from '@/lib/brand';
import { dateTime, duration, hours, relative } from '@/lib/format';
import { kindsFor } from '@/lib/kinds';
import { requireSession, tzOf } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ShiftLog, Submission } from '@/lib/types';
import { setDuty } from '../actions';

export const metadata = { title: 'Patrol panel' };

// Division command (DPS, Fire/EMS Administration) on patrol: their own clock, logs and paperwork,
// filed under the command itself. Units on duty are on the Board.
export default async function Patrol({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const commands = s.active.filter((m) => s.departments.find((d) => d.key === m.department_key)?.kind === 'oversight');
  const me = commands.find((m) => m.department_key === sp.dept) ?? commands.find((m) => m.department_key === s.current?.department_key) ?? commands[0];
  if (!me) redirect('/hub');
  const cmd = s.departments.find((d) => d.key === me.department_key)!;
  const tz = tzOf(s, cmd.key);
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: logs }, { data: filed }] = await Promise.all([
    supabase.from('shift_logs').select('*').eq('profile_id', s.userId).eq('department_key', cmd.key)
      .order('started_at', { ascending: false }).limit(6).returns<ShiftLog[]>(),
    supabase.from('submissions').select('id,ref,title,kind,status,created_at').eq('profile_id', s.userId).eq('department_key', cmd.key)
      .order('created_at', { ascending: false }).limit(6).returns<Pick<Submission, 'id' | 'ref' | 'title' | 'kind' | 'status' | 'created_at'>[]>(),
  ]);
  const onShift = me.duty_status === 'on_duty' && me.duty_changed_at;
  const week = (logs ?? []).filter((l) => l.started_at >= weekAgo && l.status !== 'returned').reduce((n, l) => n + l.duration_minutes, 0);
  const forms = kindsFor(cmd.division).filter((k) => k.group === 'report');
  const back = `/hub/patrol?dept=${cmd.key}`;

  return (
    <>
      <Flash searchParams={sp} />
      <section className="card relative mb-6 overflow-hidden p-6 sm:p-8">
        {PHOTOS[cmd.key] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={PHOTOS[cmd.key]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgb(8 6 10 / 0.95), rgb(8 6 10 / 0.55))' }} />
        <div className="relative flex items-center gap-5">
          <Emblem dept={cmd.key} label={cmd.short_name} accent={cmd.accent} division={cmd.division} size={72} />
          <div className="min-w-0">
            <PageHead eyebrow={cmd.name} title="Patrol panel" />
            <p className="-mt-4 text-[13px] text-muted">
              {me.callsign && <span className="mr-2 font-mono text-gold">{me.callsign}</span>}{me.display_name}{me.rank_name ? ` · ${me.rank_name}` : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
        <div className={`card relative flex flex-col justify-between overflow-hidden p-6 ${onShift ? 'border-ok/40' : ''}`}>
          <div>
            <div className="label flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${onShift ? 'on-duty-ring bg-ok' : 'bg-faint'}`} />
              {onShift ? `On patrol · ${cmd.short_name}` : 'Off duty'}
            </div>
            {onShift ? (
              <>
                <ShiftClock since={me.duty_changed_at!} className="mt-3 block font-mono text-[40px] leading-none font-semibold tracking-tight text-ok" />
                <p className="mt-2 text-[13px] text-muted">Started {dateTime(me.duty_changed_at!, tz)}. Ending it opens your patrol log with the times filled in.</p>
              </>
            ) : (
              <>
                <div className="mt-3 text-[24px] font-semibold tracking-tight">Going out on patrol?</div>
                <p className="mt-1.5 text-[13px] text-muted">Your time is logged under {cmd.short_name} and reviewed by another {cmd.short_name} member.</p>
              </>
            )}
          </div>
          <form action={setDuty} className="mt-6">
            <input type="hidden" name="department" value={cmd.key} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="status" value={onShift ? 'off_duty' : 'on_duty'} />
            {onShift && <input type="hidden" name="since" value={me.duty_changed_at!} />}
            <button className={`${onShift ? 'btn' : 'btn-primary'} h-12 w-full text-[15px]`}>{onShift ? 'End patrol and write the log' : 'Start patrol'}</button>
          </form>
        </div>

        <div className="card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="label">File paperwork</h2>
            <span className="text-[12px] text-faint">{hours(week)} logged in the last 7 days</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {forms.map((k) => (
              <Link key={k.key} href={`/hub/reports/new?kind=${k.key}&dept=${cmd.key}`} className="rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong">
                <div className="text-[14px] font-medium">{k.label}</div>
                <div className="mt-0.5 line-clamp-1 text-[12px] text-muted">{k.blurb}</div>
              </Link>
            ))}
          </div>
          <Link href="/hub/reports" className="mt-3 inline-block text-[13px] text-muted hover:text-ink">Every form and request →</Link>
        </div>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="label">My patrol logs</h2>
            <span className="flex gap-4 text-[13px]">
              <Link href={`/hub/shifts/new?dept=${cmd.key}`} className="text-muted hover:text-ink">Log a past patrol</Link>
              <Link href="/hub/shifts" className="text-muted hover:text-ink">All shifts →</Link>
            </span>
          </div>
          {logs?.length ? (
            <div className="card divide-y divide-line">
              {logs.map((l) => (
                <Link key={l.id} href={`/hub/shifts/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]">
                  <span className="text-[14px]">{dateTime(l.started_at, tz)}<span className="ml-2 text-muted">{duration(l.duration_minutes)}</span></span>
                  <StatusTag status={l.status} />
                </Link>
              ))}
            </div>
          ) : <Empty>No patrols logged yet.</Empty>}
        </section>
        <section>
          <h2 className="label mb-3">My paperwork</h2>
          {filed?.length ? (
            <div className="card divide-y divide-line">
              {filed.map((r) => (
                <Link key={r.id} href={`/hub/reports/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]">
                  <span className="min-w-0 truncate text-[14px]"><span className="mr-2 font-mono text-[12px] text-muted">{r.ref}</span>{r.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[12px] text-faint">{relative(r.created_at)} <StatusTag status={r.status} /></span>
                </Link>
              ))}
            </div>
          ) : <Empty>Nothing filed under {cmd.short_name} yet.</Empty>}
        </section>
      </div>

    </>
  );
}
