import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DecisionPanel } from '@/components/DecisionPanel';
import { ShiftForm, type ShiftDept } from '@/components/ShiftForm';
import { PrintHeader, SaveRecord } from '@/components/SaveRecord';
import { Flash, PageHead, StatusTag } from '@/components/ui';
import { ACTIVITY_LABEL, BODYCAM_LABEL, dateTime, duration } from '@/lib/format';
import { canDecide } from '@/lib/queue';
import { requireSession, tzOf } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIER_LABEL } from '@/lib/tiers';
import type { ApprovalAction, ShiftLog } from '@/lib/types';
import { withdrawShift } from '../../actions';

export const metadata = { title: 'Shift log' };

export default async function ShiftDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireSession();
  const supabase = await createClient();
  const [{ data: log }, { data: timeline }] = await Promise.all([
    supabase.from('shift_logs').select('*').eq('id', id).maybeSingle<ShiftLog>(),
    supabase.from('approval_actions').select('*').eq('record_id', id).order('created_at').returns<ApprovalAction[]>(),
  ]);
  if (!log) notFound();

  const mine = log.profile_id === s.userId;
  const tz = tzOf(s, log.department_key);
  const dept = s.departments.find((d) => d.key === log.department_key);
  const editable = mine && ['draft', 'returned', 'submitted'].includes(log.status);
  const withdrawable = mine && ['draft', 'submitted', 'under_review', 'returned'].includes(log.status);
  const decidable = ['submitted', 'under_review'].includes(log.status) && canDecide(s, log.department_key, log.required_tier, log.profile_id);
  const depts: ShiftDept[] = dept ? [dept] : [];

  return (
    <div className="max-w-3xl">
      <Flash searchParams={sp} />
      <PageHead eyebrow={`${dept?.short_name ?? ''} · ${log.ref}`} title={mine ? 'Your shift' : `${log.snapshot_callsign ? `${log.snapshot_callsign} · ` : ''}${log.snapshot_name}`}>
        <StatusTag status={log.status} />
        {log.status !== 'draft' && <SaveRecord title={`Shift log ${log.ref}`} />}
      </PageHead>
      <PrintHeader title={`Shift log · ${log.ref}`} sub={`${dept?.name ?? ''} · ${[log.snapshot_callsign, log.snapshot_name].filter(Boolean).join(' · ')} · Status: ${log.status.replace('_', ' ')}`} />

      {log.decision_reason && ['returned', 'denied'].includes(log.status) && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-[14px] ${log.status === 'denied' ? 'border-bad/30 text-bad' : 'border-warn/30 text-warn'}`}>
          <div className="label mb-1 !text-current">{log.status === 'denied' ? 'Denied' : 'Returned'} by {log.decided_by_name}</div>
          {log.decision_reason}
        </div>
      )}

      <dl className="card grid gap-x-6 gap-y-4 p-6 text-[14px] sm:grid-cols-3">
        <div><dt className="label">Started</dt><dd className="mt-1">{dateTime(log.started_at, tz)}</dd></div>
        <div><dt className="label">Ended</dt><dd className="mt-1">{dateTime(log.ended_at, tz)}</dd></div>
        <div><dt className="label">Counts as</dt><dd className="mt-1">{duration(log.duration_minutes)}{log.break_minutes ? ` (${log.break_minutes}m break)` : ''}</dd></div>
        <div><dt className="label">Activity</dt><dd className="mt-1">{ACTIVITY_LABEL[log.activity_type]}</dd></div>
        <div><dt className="label">Bodycam</dt><dd className="mt-1">
          {log.recording_url ? <a href={log.recording_url} target="_blank" rel="noreferrer" className="text-gold">Recorded</a> : BODYCAM_LABEL[log.bodycam_status]}
          {log.bodycam_explanation && <span className="block text-muted">{log.bodycam_explanation}</span>}
        </dd></div>
        <div><dt className="label">Reviewed by</dt><dd className="mt-1">{TIER_LABEL[log.required_tier]}{log.required_tier !== 'dps' ? ' or above' : ''}</dd></div>
        <div className="sm:col-span-3"><dt className="label">Summary</dt><dd className="mt-1 whitespace-pre-wrap text-muted">{log.summary || '—'}</dd></div>
        <div className="sm:col-span-3 text-[12px] text-faint">
          Logged as {[log.snapshot_rank, log.snapshot_callsign, log.snapshot_badge && `#${log.snapshot_badge}`].filter(Boolean).join(' · ')}
          {log.cad_reference && ` · CAD ${log.cad_reference}`}
        </div>
      </dl>

      {decidable && (
        <section className="no-print card mt-6 p-6">
          <h2 className="label mb-4">Your decision</h2>
          <DecisionPanel log={log} back={`/hub/shifts/${log.id}`} canEscalate={!s.oversees(log.department_key)} />
        </section>
      )}

      {editable && (
        <section className="no-print mt-10">
          <h2 className="label mb-4">{log.status === 'returned' ? 'Correct and resubmit' : log.status === 'draft' ? 'Finish this draft' : 'Edit before it is reviewed'}</h2>
          <ShiftForm depts={depts} lockedDepartment initial={{
            id: log.id, version: log.version, department: log.department_key, started_at: log.started_at, ended_at: log.ended_at,
            break_minutes: log.break_minutes, activity_type: log.activity_type, summary: log.summary, cad_reference: log.cad_reference,
            recording_url: log.recording_url, bodycam_status: log.bodycam_status === 'not_required' ? '' : log.bodycam_status,
            bodycam_explanation: log.bodycam_explanation,
          }} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="label mb-4">Timeline</h2>
        <ol className="grid gap-3 border-l border-line pl-5">
          {(timeline ?? []).map((t) => (
            <li key={t.id} className="relative text-[14px]">
              <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-line-strong" />
              <span className="font-medium capitalize">{t.action}</span>
              <span className="text-muted"> by {t.actor_name}{t.actor_tier ? ` (${TIER_LABEL[t.actor_tier]})` : ''}</span>
              <span className="text-faint"> · {dateTime(t.created_at, tz)}</span>
              {t.reason && <div className="mt-0.5 text-muted">“{t.reason}”</div>}
            </li>
          ))}
          {!timeline?.length && <li className="text-[14px] text-muted">Not submitted yet.</li>}
        </ol>
      </section>

      {withdrawable && (
        <form action={withdrawShift} className="mt-10 flex flex-wrap items-end gap-2 border-t border-line pt-6">
          <input type="hidden" name="id" value={log.id} />
          <label className="field min-w-60 flex-1"><span>Withdraw this entry (frees its hours)</span>
            <input name="reason" className="input" placeholder="Reason (optional)" />
          </label>
          <button className="btn-danger">Withdraw</button>
        </form>
      )}
      <Link href={mine ? '/hub/shifts' : '/hub/approvals'} className="no-print mt-8 inline-block text-[13px] text-muted hover:text-ink">← Back</Link>
    </div>
  );
}
