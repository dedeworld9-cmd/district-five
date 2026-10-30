import Link from 'next/link';
import { Kpi, Panel, ResourceGrid, WorkspaceHeader, type ResourceItem } from '@/components/ops/kit';
import { hours } from '@/lib/format';
import { tzOf, type Session } from '@/lib/session';
import { SITE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import type { ShiftLog } from '@/lib/types';
import { RecentTable } from './recent';

const FILTERS = [['', 'All'], ['draft', 'Drafts'], ['submitted', 'Waiting'], ['returned', 'Returned'], ['approved', 'Approved']] as const;

export async function LoggingOverview({ s, sp = {} }: { s: Session; sp?: Record<string, string | undefined> }) {
  const supabase = await createClient();
  const { data } = await supabase.from('shift_logs').select('*').eq('profile_id', s.userId).eq('department_key', SITE.department)
    .order('started_at', { ascending: false }).limit(100).returns<ShiftLog[]>();
  const all = data ?? [];
  const approved = all.filter((l) => l.status === 'approved');
  const sum = (xs: ShiftLog[]) => xs.reduce((n, l) => n + l.duration_minutes, 0);
  const pending = all.filter((l) => l.status === 'submitted' || l.status === 'under_review');
  const training = approved.filter((l) => l.activity_type === 'training');
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = all.filter((l) =>
    (!sp.status || (sp.status === 'submitted' ? pending.includes(l) : l.status === sp.status)) &&
    (!q || `${l.ref} ${l.activity_type} ${l.summary}`.toLowerCase().includes(q))).slice(0, 12);

  const dest: ResourceItem[] = [
    { title: 'Results', desc: 'Results posted by command.', icon: 'flag', channel: 'results' },
    { title: 'Infractions', desc: 'Infractions recorded in Discord.', icon: 'shield', channel: 'infractions' },
    { title: 'Shift Logs', desc: 'Your submitted shift logs in the hub.', icon: 'list', href: '/hub/shifts' },
    { title: 'General Logs', desc: 'Department logs channel.', icon: 'doc', channel: 'logs' },
    { title: 'Supervisor Incident Reports', desc: 'File and track reports in the hub.', icon: 'doc', href: '/hub/reports' },
    { title: 'Warrants', desc: 'Warrants handled in Discord.', icon: 'key', channel: 'warrants' },
    { title: 'Backup Logs', desc: 'Backup logs kept in Discord.', icon: 'book', channel: 'backup-logs' },
  ];

  return (
    <>
      <WorkspaceHeader title="Logging Center" description="Log your activity, follow its review and reach the department logging channels.">
        <Link href="/hub/shifts/new" className="btn-primary">New activity log</Link>
      </WorkspaceHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Kpi label="Qualifying hours" value={hours(sum(approved))} sub="Approved, last 100 logs" />
        <Kpi label="Activity logs" value={all.length} sub="Your logs on record" />
        <Kpi label="Pending review" value={pending.length} sub={pending.length ? hours(sum(pending)) : 'Nothing waiting'} href="/hub/shifts?status=submitted" />
        <Kpi label="Training hours" value={hours(sum(training))} sub="Approved training logs" />
      </div>

      <Panel title="Recent activity" action={<Link href="/hub/shifts" className="text-[13px] text-gold">All shift logs</Link>}>
        <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="field"><span className="sr-only">Search activity</span>
            <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search by reference, activity or summary" className="input" /></label>
          <div className="flex gap-2">
            <label className="field min-w-0 flex-1"><span className="sr-only">Status</span>
              <select name="status" defaultValue={sp.status ?? ''} className="input">{FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <button className="btn">Filter</button>
          </div>
        </form>
        <RecentTable logs={shown} tz={tzOf(s, SITE.department)} empty={<>No activity matches. <Link href="/hub/shifts/new" className="text-gold">Log activity</Link></>} />
      </Panel>

      <section className="mt-8">
        <h2 className="mb-4 text-[17px] font-semibold">Logging destinations</h2>
        <ResourceGrid items={dest} cols={4} />
      </section>
    </>
  );
}
