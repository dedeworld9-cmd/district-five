import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConfirmButton } from '@/components/ops/Confirm';
import { DiscordLink, Panel, WorkspaceHeader } from '@/components/ops/kit';
import { DraftRecovery } from '@/components/ops/PatrolControls';
import { ShiftClock } from '@/components/ShiftClock';
import { Flash } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { requireSession, tzOf } from '@/lib/session';
import { SITE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import type { Policy, ShiftLog } from '@/lib/types';
import { setDuty } from '../actions';
import { RecentTable } from '../_ops/recent';

export const metadata = { title: 'Patrol Operations' };

// The patrol clock is the member's duty status, stored by the database when they start and end.
// The timer on screen only displays elapsed time; credited time is set when the log is submitted
// and approved. There is no pause: breaks are entered as minutes in the log.
export default async function Patrol({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const me = s.active.find((m) => m.department_key === SITE.department);
  if (!me) redirect('/hub');
  const tz = tzOf(s, me.department_key);
  const supabase = await createClient();
  const [{ data: logs }, { data: sops }] = await Promise.all([
    supabase.from('shift_logs').select('*').eq('profile_id', s.userId).eq('department_key', me.department_key).order('started_at', { ascending: false }).limit(6).returns<ShiftLog[]>(),
    supabase.from('policies').select('id,title,source_url').eq('department_key', me.department_key).eq('status', 'approved').order('title').limit(7).returns<Pick<Policy, 'id' | 'title' | 'source_url'>[]>(),
  ]);
  const since = me.duty_status === 'on_duty' ? me.duty_changed_at : null;

  return (
    <>
      <Flash searchParams={sp} />
      <WorkspaceHeader title="Patrol Operations" description="Start your patrol, keep the clock, then log it for review.">
        <Link href="/hub/shifts/new" className="btn">Manual activity log</Link>
      </WorkspaceHeader>

      <section className="card mb-5 grid overflow-hidden lg:grid-cols-[3fr_2fr]" aria-label="Patrol control panel">
        <div className="p-5 md:p-7">
          <div className="flex items-center gap-2 text-[13px]">
            <span className={`h-2 w-2 rounded-full ${since ? 'on-duty-ring bg-ok' : 'bg-faint'}`} />
            <span className={since ? 'font-medium text-ok' : 'text-muted'}>{since ? 'Patrol in progress' : 'Not on patrol'}</span>
          </div>
          <div className="tnum mt-3 font-mono text-[44px] leading-none font-semibold tracking-tight md:text-[52px]" aria-live="off">
            {since ? <ShiftClock since={since} /> : '00:00:00'}
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-3">
            <div><dt className="text-faint">Started</dt><dd className="mt-0.5 text-[14px]">{since ? dateTime(since, tz) : '—'}</dd></div>
            <div><dt className="text-faint">Break</dt><dd className="mt-0.5 text-[14px] text-muted">Entered in the log</dd></div>
            <div><dt className="text-faint">Qualifying time</dt><dd className="mt-0.5 text-[14px] text-muted">End − start − breaks</dd></div>
          </dl>
          <p className="mt-5 text-[12px] leading-relaxed text-faint">
            {since
              ? 'Your start time is saved by the hub, so closing this page does not stop the clock. The timer is a display only: approved time comes from the log you submit.'
              : 'Starting a patrol saves your start time in the hub. Forgot to start? Use the manual activity log and enter the times yourself.'}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 border-t border-line bg-white/[0.02] p-5 md:p-7 lg:border-t-0 lg:border-l">
          {since ? (
            <form action={setDuty} className="grid gap-3">
              <input type="hidden" name="department" value={me.department_key} />
              <input type="hidden" name="status" value="off_duty" />
              <input type="hidden" name="since" value={since} />
              <input type="hidden" name="back" value="/hub/patrol" />
              <ConfirmButton label="End patrol and write the log" title="End this patrol?" confirmLabel="End patrol" className="btn-primary h-14 w-full text-[15px]">
                Your patrol stops now and the log form opens with your times filled in. Nothing is submitted until you press Submit.
              </ConfirmButton>
            </form>
          ) : (
            <form action={setDuty}>
              <input type="hidden" name="department" value={me.department_key} />
              <input type="hidden" name="status" value="on_duty" />
              <input type="hidden" name="back" value="/hub/patrol" />
              <button className="btn-brand h-14 w-full text-[16px] font-semibold">Start patrol</button>
            </form>
          )}
          <Link href="/hub/shifts/new" className="btn w-full">Log patrol manually</Link>
          <DraftRecovery />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Panel title="Patrol information" action={<DiscordLink channel="patrol-information" className="text-[13px] text-gold" label="#patrol-information" />}>
          <p className="mb-3 text-[13px] text-muted">Approved standard operating procedures.</p>
          {sops?.length ? (
            <ul className="divide-y divide-line">
              {sops.map((p) => (
                <li key={p.id}>
                  {p.source_url
                    ? <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px] hover:text-gold">{p.title}<span className="text-gold" aria-hidden="true">↗</span><span className="sr-only">Opens in a new tab</span></a>
                    : <span className="flex min-h-11 items-center py-2 text-[14px] text-muted">{p.title}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="body-sm">No procedures are published in the hub yet.</p>}
          <Link href="/hub/resources" className="mt-3 inline-block text-[13px] text-gold">All resources →</Link>
        </Panel>
        <Panel title="Communications">
          <ul className="grid gap-2 text-[14px]">
            {([['patrol-announcements', 'Patrol Announcements'], ['patrol-chat', 'Patrol Chat'], ['patrol-suggestions', 'Suggestions']] as const).map(([c, l]) => (
              <li key={c}><DiscordLink channel={c} label={l} className="flex min-h-11 items-center justify-between rounded-lg border border-line px-3 hover:border-line-strong" /></li>
            ))}
            <li><Link href="/hub/board" className="flex min-h-11 items-center justify-between rounded-lg border border-line px-3 hover:border-line-strong">Units on duty<span aria-hidden="true">→</span></Link></li>
          </ul>
        </Panel>
      </div>

      <Panel title="Recent patrol activity" className="mt-5" action={<Link href="/hub/shifts" className="text-[13px] text-gold">All logs</Link>}>
        <RecentTable logs={logs ?? []} tz={tz} empty={<>No patrols logged yet.</>} />
      </Panel>
    </>
  );
}
