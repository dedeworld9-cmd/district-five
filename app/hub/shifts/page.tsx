import Link from 'next/link';
import { PrintHeader, SaveRecord } from '@/components/SaveRecord';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { ACTIVITY_LABEL, dateTime, duration } from '@/lib/format';
import { requireSession, tzOf } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ShiftLog } from '@/lib/types';

export const metadata = { title: 'Shifts' };

const FILTERS = [
  ['', 'All'], ['draft', 'Drafts'], ['submitted', 'Waiting'], ['returned', 'Returned'], ['approved', 'Approved'], ['denied', 'Denied'], ['withdrawn', 'Withdrawn'],
] as const;

export default async function Shifts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  let q = supabase.from('shift_logs').select('*').eq('profile_id', s.userId).order('started_at', { ascending: false }).limit(100);
  if (sp.status === 'submitted') q = q.in('status', ['submitted', 'under_review']);
  else if (sp.status) q = q.eq('status', sp.status);
  const { data: logs } = await q.returns<ShiftLog[]>();
  const short = (k: string) => s.departments.find((d) => d.key === k)?.short_name ?? k;

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow="Activity" title="Your shifts">
        {!!logs?.length && <SaveRecord title="My shift logs" label="Save as PDF" />}
        <Link href="/hub/shifts/new" className="no-print btn-primary">Log a shift</Link>
      </PageHead>
      <PrintHeader title="Shift logs" sub={s.profile.display_name} />
      <div className="no-print mb-5 flex flex-wrap gap-1">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={v ? `/hub/shifts?status=${v}` : '/hub/shifts'}
            className={`rounded-full px-3 py-1.5 text-[13px] ${(sp.status ?? '') === v ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{l}</Link>
        ))}
      </div>
      {logs?.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Reference</th><th>Department</th><th>Started</th><th>Time</th><th>Activity</th><th>Status</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td><Link href={`/hub/shifts/${l.id}`} className="font-mono text-[13px] hover:text-gold">{l.ref}</Link></td>
                  <td>{short(l.department_key)}</td>
                  <td className="whitespace-nowrap text-muted">{dateTime(l.started_at, tzOf(s, l.department_key))}</td>
                  <td>{duration(l.duration_minutes)}</td>
                  <td className="text-muted">{ACTIVITY_LABEL[l.activity_type]}</td>
                  <td><StatusTag status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No shifts here yet.</Empty>}
    </>
  );
}
