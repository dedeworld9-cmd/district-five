import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmissionDecision } from '@/components/SubmissionDecision';
import { SubmissionForm } from '@/components/SubmissionForm';
import { Flash, PageHead, StatusTag } from '@/components/ui';
import { dateOnly, dateTime } from '@/lib/format';
import { KIND } from '@/lib/kinds';
import { canDecide } from '@/lib/queue';
import { requireSession, tzOf } from '@/lib/session';
import { formContext } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';
import { TIER_LABEL } from '@/lib/tiers';
import type { ApprovalAction, Submission } from '@/lib/types';
import { decideSubmission, withdrawSubmission } from '../../actions';

export const metadata = { title: 'Report' };

export default async function SubmissionDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireSession();
  const supabase = await createClient();
  const [{ data: sub }, { data: timeline }] = await Promise.all([
    supabase.from('submissions').select('*').eq('id', id).maybeSingle<Submission>(),
    supabase.from('approval_actions').select('*').eq('record_type', 'submission').eq('record_id', id).order('created_at').returns<ApprovalAction[]>(),
  ]);
  if (!sub) notFound();
  const cfg = KIND[sub.kind];
  const { data: subject } = sub.subject_membership
    ? await supabase.from('memberships').select('display_name,callsign').eq('id', sub.subject_membership).maybeSingle<{ display_name: string; callsign: string | null }>()
    : { data: null };

  const mine = sub.profile_id === s.userId;
  const tz = tzOf(s, sub.department_key);
  const dept = s.departments.find((d) => d.key === sub.department_key);
  const editable = mine && ['draft', 'returned'].includes(sub.status);
  const withdrawable = mine && ['draft', 'submitted', 'under_review', 'returned'].includes(sub.status);
  const decidable = ['submitted', 'under_review'].includes(sub.status) && canDecide(s, sub.department_key, sub.required_tier, sub.profile_id);
  const active = ['warrant', 'bolo'].includes(sub.kind) && sub.status === 'approved' && !!sub.expires_at && new Date(sub.expires_at) > new Date();
  const clearable = active && !mine && s.canSupervise(sub.department_key);
  const ctx = editable ? await formContext(s, sub.kind) : null;

  return (
    <div className="max-w-3xl">
      <Flash searchParams={sp} />
      <PageHead eyebrow={`${dept?.short_name ?? ''} · ${cfg?.label ?? sub.kind} · ${sub.ref}`} title={sub.title}>
        {active && <span className="tag tag-gold">Active</span>}
        <StatusTag status={sub.status} />
      </PageHead>

      {sub.decision_reason && ['returned', 'denied', 'approved', 'archived'].includes(sub.status) && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-[14px] ${sub.status === 'denied' ? 'border-bad/30 text-bad' : sub.status === 'returned' ? 'border-warn/30 text-warn' : 'border-line-strong text-muted'}`}>
          <div className="label mb-1 !text-current">{sub.status === 'archived' ? 'Cleared' : sub.status[0].toUpperCase() + sub.status.slice(1)} by {sub.decided_by_name ?? 'command'}</div>
          {sub.decision_reason}
        </div>
      )}

      <dl className="card grid gap-x-6 gap-y-4 p-6 text-[14px] sm:grid-cols-2">
        <div><dt className="label">Filed by</dt><dd className="mt-1">{[sub.snapshot_callsign, sub.snapshot_name].filter(Boolean).join(' · ')}
          <span className="block text-[12px] text-faint">{[sub.snapshot_rank, sub.snapshot_badge && `#${sub.snapshot_badge}`].filter(Boolean).join(' · ')}</span></dd></div>
        <div><dt className="label">Reviewed by</dt><dd className="mt-1">{TIER_LABEL[sub.required_tier]}{sub.required_tier !== 'dps' ? ' or above' : ''}</dd></div>
        {cfg?.occurred && <div><dt className="label">{cfg.occurred}</dt><dd className="mt-1">{sub.occurred_on ? dateOnly(sub.occurred_on) : '—'}</dd></div>}
        {cfg?.expires && <div><dt className="label">Expires</dt><dd className="mt-1">{sub.expires_at ? dateTime(sub.expires_at, tz) : '—'}</dd></div>}
        {cfg?.subject && <div><dt className="label">Probationary member</dt><dd className="mt-1">{subject ? [subject.callsign, subject.display_name].filter(Boolean).join(' · ') : '—'}</dd></div>}
        {(cfg?.fields ?? []).map((f) => (
          <div key={f.name} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <dt className="label">{f.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-muted">{sub.details[f.name] ?? '—'}</dd>
          </div>
        ))}
        {sub.evidence_url && (
          <div className="sm:col-span-2"><dt className="label">Evidence</dt>
            <dd className="mt-1"><a href={sub.evidence_url} target="_blank" rel="noreferrer noopener" className="break-all text-gold">{sub.evidence_url}</a></dd></div>
        )}
      </dl>

      {decidable && (
        <section className="card mt-6 p-6">
          <h2 className="label mb-4">Your decision</h2>
          <SubmissionDecision sub={sub} back={`/hub/reports/${sub.id}`} canEscalate={!s.oversees(sub.department_key)} />
        </section>
      )}

      {clearable && (
        <form className="card mt-6 flex flex-wrap items-end gap-2 p-6">
          <input type="hidden" name="id" value={sub.id} />
          <input type="hidden" name="back" value={`/hub/reports/${sub.id}`} />
          <label className="field min-w-60 flex-1"><span>Clear from the active list</span>
            <input name="reason" className="input" placeholder="Served, located, or no longer needed" />
          </label>
          <button formAction={decideSubmission.bind(null, 'archive')} className="btn">Clear</button>
        </form>
      )}

      {editable && ctx && (
        <section className="mt-10">
          <h2 className="label mb-4">{sub.status === 'returned' ? 'Correct and resubmit' : 'Finish this draft'}</h2>
          <SubmissionForm kind={sub.kind} depts={ctx.depts} options={ctx.options} subjects={ctx.subjects} lockedDepartment initial={{
            id: sub.id, version: sub.version, department: sub.department_key, details: sub.details, evidence_url: sub.evidence_url,
            occurred_on: sub.occurred_on, expires_at: sub.expires_at, subject: sub.subject_membership,
          }} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="label mb-4">Timeline</h2>
        <ol className="grid gap-3 border-l border-line pl-5">
          {(timeline ?? []).map((t) => (
            <li key={t.id} className="relative text-[14px]">
              <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-line-strong" />
              <span className="font-medium capitalize">{t.action === 'archived' ? 'cleared' : t.action}</span>
              <span className="text-muted"> by {t.actor_name}{t.actor_tier ? ` (${TIER_LABEL[t.actor_tier]})` : ''}</span>
              <span className="text-faint"> · {dateTime(t.created_at, tz)}</span>
              {t.reason && <div className="mt-0.5 text-muted">“{t.reason}”</div>}
            </li>
          ))}
          {!timeline?.length && <li className="text-[14px] text-muted">Not submitted yet.</li>}
        </ol>
      </section>

      {withdrawable && (
        <form action={withdrawSubmission} className="mt-10 flex flex-wrap items-end gap-2 border-t border-line pt-6">
          <input type="hidden" name="id" value={sub.id} />
          <label className="field min-w-60 flex-1"><span>Withdraw this {cfg?.group === 'report' ? 'report' : 'request'}</span>
            <input name="reason" className="input" placeholder="Reason (optional)" />
          </label>
          <button className="btn-danger">Withdraw</button>
        </form>
      )}
      <Link href={mine ? '/hub/reports' : '/hub/approvals'} className="mt-8 inline-block text-[13px] text-muted hover:text-ink">← Back</Link>
    </div>
  );
}
