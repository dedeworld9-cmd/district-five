import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DecisionPanel } from '@/components/DecisionPanel';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { ACTIVITY_LABEL, BODYCAM_LABEL, dateTime, duration, relative } from '@/lib/format';
import { canDecide } from '@/lib/queue';
import { requireSession, tzOf } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIER_LABEL } from '@/lib/tiers';
import type { ShiftLog } from '@/lib/types';

export const metadata = { title: 'Approvals' };

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.supervised.length && !s.isDps) redirect('/hub');
  const supabase = await createClient();
  const [{ data: open }, { data: decided }] = await Promise.all([
    supabase.from('shift_logs').select('*').in('status', ['submitted', 'under_review']).order('submitted_at').returns<ShiftLog[]>(),
    supabase.from('shift_logs').select('*').eq('decided_by', s.userId).order('decided_at', { ascending: false }).limit(10).returns<ShiftLog[]>(),
  ]);
  const deptFilter = sp.dept;
  const mine = (open ?? []).filter((l) => canDecide(s, l.department_key, l.required_tier, l.profile_id) && (!deptFilter || l.department_key === deptFilter));
  const others = (open ?? []).filter((l) => !canDecide(s, l.department_key, l.required_tier, l.profile_id) && l.profile_id !== s.userId);
  const short = (k: string) => s.departments.find((d) => d.key === k)?.short_name ?? k;
  const deptKeys = [...new Set((open ?? []).map((l) => l.department_key))];

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow="Review" title="Approvals">
        {deptKeys.length > 1 && (
          <div className="flex gap-1">
            <Link href="/hub/approvals" className={`rounded-full px-3 py-1.5 text-[13px] ${!deptFilter ? 'bg-white/[0.08]' : 'text-muted'}`}>All</Link>
            {deptKeys.map((k) => (
              <Link key={k} href={`/hub/approvals?dept=${k}`} className={`rounded-full px-3 py-1.5 text-[13px] ${deptFilter === k ? 'bg-white/[0.08]' : 'text-muted'}`}>{short(k)}</Link>
            ))}
          </div>
        )}
      </PageHead>

      {mine.length ? (
        <div className="grid gap-3">
          {mine.map((l) => {
            const tz = tzOf(s, l.department_key);
            return (
              <article key={l.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[12px] text-faint">
                      <span>{short(l.department_key)}</span><span>·</span>
                      <Link href={`/hub/shifts/${l.id}`} className="font-mono hover:text-gold">{l.ref}</Link><span>·</span>
                      <span>sent {l.submitted_at ? relative(l.submitted_at) : ''}</span>
                    </div>
                    <div className="mt-1 text-[16px] font-medium">
                      {l.snapshot_callsign ? `${l.snapshot_callsign} · ` : ''}{l.snapshot_name}
                      <span className="ml-2 text-[13px] font-normal text-muted">{l.snapshot_rank}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.required_tier === 'dps' && <span className="tag tag-gold">Command review</span>}
                    {l.assigned_to && <span className="tag">{l.assigned_to === s.userId ? 'Claimed by you' : 'Claimed'}</span>}
                    <StatusTag status={l.status} />
                  </div>
                </div>
                <div className="mt-4 grid gap-1 text-[14px] sm:grid-cols-[auto_1fr] sm:gap-x-6">
                  <div className="text-muted">{dateTime(l.started_at, tz)} → {dateTime(l.ended_at, tz)}</div>
                  <div><span className="font-medium">{duration(l.duration_minutes)}</span> <span className="text-muted">· {ACTIVITY_LABEL[l.activity_type]} · bodycam {BODYCAM_LABEL[l.bodycam_status].toLowerCase()}</span>
                    {l.recording_url && <> · <a href={l.recording_url} target="_blank" rel="noreferrer" className="text-gold">footage</a></>}</div>
                </div>
                {l.summary && <p className="mt-3 line-clamp-3 text-[14px] whitespace-pre-wrap text-muted">{l.summary}</p>}
                {l.bodycam_explanation && <p className="mt-2 text-[13px] text-warn">Footage unavailable: {l.bodycam_explanation}</p>}
                <div className="mt-5 border-t border-line pt-4">
                  <DecisionPanel log={l} back="/hub/approvals" canEscalate={!s.oversees(l.department_key)} />
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty>Nothing is waiting for you.</Empty>}

      {others.length > 0 && (
        <p className="mt-6 text-[13px] text-faint">
          {others.length} other {others.length === 1 ? 'entry is' : 'entries are'} waiting for a higher tier ({[...new Set(others.map((o) => TIER_LABEL[o.required_tier]))].join(', ')}).
        </p>
      )}

      {decided && decided.length > 0 && (
        <section className="mt-12">
          <h2 className="label mb-4">Recently decided by you</h2>
          <div className="card divide-y divide-line">
            {decided.map((l) => (
              <Link key={l.id} href={`/hub/shifts/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px] hover:bg-white/[0.02]">
                <span>{l.snapshot_name} <span className="text-muted">· {duration(l.duration_minutes)} · {short(l.department_key)}</span></span>
                <StatusTag status={l.status} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
