import Link from 'next/link';
import { DataTable } from '@/components/ops/kit';
import { StatusTag } from '@/components/ui';
import { ACTIVITY_LABEL, dateOnly, duration, timeOnly } from '@/lib/format';
import type { ShiftLog } from '@/lib/types';

// Recent activity rows shared by the Patrol and Logging overviews.
export function RecentTable({ logs, tz, empty }: { logs: ShiftLog[]; tz: string; empty: React.ReactNode }) {
  return (
    <DataTable
      columns={['Activity', 'Date', 'Start / End', 'Qualifying', 'Status', '']}
      empty={empty}
      rows={logs.map((l) => ({
        key: l.id,
        cells: [
          <span key="a"><span className="font-medium">{ACTIVITY_LABEL[l.activity_type] ?? l.activity_type}</span> <span className="font-mono text-[12px] text-faint">{l.ref}</span></span>,
          <span key="d" className="text-muted">{dateOnly(l.started_at, tz)}</span>,
          <span key="t" className="tnum whitespace-nowrap text-muted">{timeOnly(l.started_at, tz)} – {timeOnly(l.ended_at, tz)}</span>,
          <span key="q" className="tnum">{duration(l.duration_minutes)}</span>,
          <StatusTag key="s" status={l.status} />,
          <Link key="o" href={`/hub/shifts/${l.id}`} className="link" aria-label={`Open ${l.ref}`}>Open</Link>,
        ],
      }))}
    />
  );
}
