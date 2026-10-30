'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { saveShift, type ShiftFormState } from '@/app/hub/actions';
import { ACTIVITY_LABEL, DIVISION_ACTIVITIES } from '@/lib/format';

export interface ShiftDept {
  key: string; short_name: string; division: string; bodycam_required: boolean;
  bodycam_policy_text: string | null; bodycam_policy_url: string | null;
}

export interface ShiftInitial {
  id?: string; version?: number; department: string; started_at?: string; ended_at?: string;
  break_minutes?: number; activity_type?: string; summary?: string; cad_reference?: string | null;
  recording_url?: string | null; bodycam_status?: string; bodycam_explanation?: string | null;
}


// datetime-local works in the browser's time zone; the database stores UTC.
const toLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

type Fields = {
  department: string; start: string; end: string; break_minutes: string; activity_type: string; summary: string;
  cad_reference: string; bodycam_status: string; recording_url: string; bodycam_explanation: string;
};

export function ShiftForm({ depts, initial, lockedDepartment }: { depts: ShiftDept[]; initial: ShiftInitial; lockedDepartment?: boolean }) {
  const [state, action, pending] = useActionState<ShiftFormState, FormData>(saveShift, {});
  const storageKey = `d5:shift:${initial.id ?? 'new'}`;
  const [mounted, setMounted] = useState(false);
  // Which button was pressed. Set on click, because a submit button's own value is not reliably sent.
  const intent = useRef<HTMLInputElement>(null);
  const [restored, setRestored] = useState(false);
  const [f, setF] = useState<Fields>({
    department: initial.department, start: '', end: '', break_minutes: String(initial.break_minutes ?? 0),
    activity_type: initial.activity_type ?? '', summary: initial.summary ?? '', cad_reference: initial.cad_reference ?? '',
    bodycam_status: initial.bodycam_status ?? '', recording_url: initial.recording_url ?? '', bodycam_explanation: initial.bodycam_explanation ?? '',
  });

  useEffect(() => {
    let next = { ...f, start: toLocal(initial.started_at), end: toLocal(initial.ended_at) };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        // A shift that just ended keeps its clocked times over an older unsaved draft.
        const times = initial.started_at ? { start: next.start, end: next.end } : {};
        next = { ...next, ...JSON.parse(saved), ...times };
        setRestored(true);
      }
    } catch { /* storage unavailable */ }
    setF(next);
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(storageKey, JSON.stringify(f)); } catch { /* storage unavailable */ }
  }, [f, mounted, storageKey]);

  // The draft is cleared on submit; put it back if the server refused the entry.
  useEffect(() => {
    if (!state.error) return;
    try { localStorage.setItem(storageKey, JSON.stringify(f)); } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const dept = depts.find((d) => d.key === f.department) ?? depts[0];
  const activities = DIVISION_ACTIVITIES[dept?.division ?? 'leo'] ?? DIVISION_ACTIVITIES.leo;
  // Switching to a department in another division resets an activity it does not offer.
  const activity = activities.includes(f.activity_type) ? f.activity_type : activities[0];
  const minutes = useMemo(() => {
    if (!f.start || !f.end) return null;
    return Math.floor((new Date(f.end).getTime() - new Date(f.start).getTime()) / 60000) - (Number(f.break_minutes) || 0);
  }, [f.start, f.end, f.break_minutes]);
  const problem =
    minutes === null ? null
      : minutes < 5 ? 'End time must be at least 5 minutes after the start, after breaks.'
      : minutes > 960 ? 'A single entry cannot exceed 16 hours. Split it into separate shifts.'
      : null;

  const clearDraft = () => { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } };

  // Unsaved-changes warning: the browser asks before leaving while the form differs from what was loaded.
  const baseline = useRef<string>('');
  const submitting = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => { if (mounted && !baseline.current) baseline.current = JSON.stringify(f); }, [mounted, f]);
  useEffect(() => {
    if (!mounted) return;
    setDirty(JSON.stringify(f) !== baseline.current);
    const t = new Date();
    setSavedAt(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
  }, [f, mounted]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { if (!submitting.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { if (state.error) submitting.current = false; }, [state]);

  const nowLocal = () => toLocal(new Date().toISOString());
  const ago = (mins: number) => toLocal(new Date((f.end ? new Date(f.end) : new Date()).getTime() - mins * 60000).toISOString());

  if (!mounted) return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="skeleton h-96" /><div className="skeleton hidden h-64 lg:block" /></div>;

  const elapsed = f.start && f.end ? Math.floor((new Date(f.end).getTime() - new Date(f.start).getTime()) / 60000) : null;
  const brk = Number(f.break_minutes) || 0;
  const fmt = (m: number | null) => (m === null || Number.isNaN(m) ? '—' : `${Math.floor(Math.abs(m) / 60)}h ${Math.abs(m) % 60}m`);
  const summary = (
    <dl className="grid gap-3 text-[14px]">
      <div className="flex justify-between gap-3"><dt className="text-muted">Elapsed</dt><dd className="tnum">{fmt(elapsed)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted">Break deduction</dt><dd className="tnum">{brk ? `− ${fmt(brk)}` : 'None'}</dd></div>
      <div className="flex justify-between gap-3 border-t border-line pt-3"><dt className="font-medium">Qualifying time</dt><dd className={`tnum text-[18px] font-semibold ${problem ? 'text-bad' : 'text-gold'}`}>{minutes === null ? '—' : problem ? 'Check times' : fmt(minutes)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted">Validation</dt>
        <dd className={problem ? 'text-bad' : minutes === null ? 'text-faint' : 'text-ok'}>{problem ? 'Needs attention' : minutes === null ? 'Add times' : 'Looks good'}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted">Draft</dt>
        <dd className="text-right text-faint">{dirty ? `Kept in this browser${savedAt ? ` · ${savedAt}` : ''}` : initial.id ? 'Saved' : 'Nothing entered'}</dd></div>
    </dl>
  );
  const section = 'card p-5 md:p-6';
  const h = 'mb-4 text-[15px] font-semibold';

  return (
    <form action={(fd) => { submitting.current = true; clearDraft(); return action(fd); }} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.version && <input type="hidden" name="version" value={initial.version} />}
      <input type="hidden" name="intent" ref={intent} defaultValue="draft" />
      <input type="hidden" name="started_at" value={toIso(f.start)} />
      <input type="hidden" name="ended_at" value={toIso(f.end)} />
      {lockedDepartment && <input type="hidden" name="department" value={f.department} />}

      <div className="grid min-w-0 gap-5">
        {restored && (
          <p className="rounded-xl border border-line-strong px-4 py-3 text-[13px] text-muted">
            Restored unsaved changes from this browser.{' '}
            <button type="button" className="text-gold underline-offset-2 hover:underline" onClick={() => { clearDraft(); submitting.current = true; location.reload(); }}>Discard them</button>
          </p>
        )}
        {state.error && <p role="alert" data-flash="error" className="rounded-xl border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[14px] text-bad">{state.error}</p>}

        <section className={section} aria-labelledby="sec-activity">
          <h2 id="sec-activity" className={h}>1 · Activity information</h2>
          <div className="grid gap-4 [&>*]:min-w-0 sm:grid-cols-2">
            {depts.length > 1 && !lockedDepartment ? (
              <label className="field"><span>Department</span>
                <select name="department" className="input" value={f.department} onChange={set('department')}>
                  {depts.map((d) => <option key={d.key} value={d.key}>{d.short_name}</option>)}
                </select>
              </label>
            ) : (
              <>
                {!lockedDepartment && <input type="hidden" name="department" value={f.department} />}
                <div className="field"><span>Department</span><div className="input flex items-center text-muted">{dept?.short_name}</div></div>
              </>
            )}
            <label className="field"><span>Activity</span>
              <select name="activity_type" className="input" value={activity} onChange={set('activity_type')}>
                {activities.map((v) => <option key={v} value={v}>{ACTIVITY_LABEL[v] ?? v}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className={section} aria-labelledby="sec-time">
          <h2 id="sec-time" className={h}>2 · Time &amp; duration</h2>
          <div className="grid gap-4 [&>*]:min-w-0 sm:grid-cols-2">
            <label className="field"><span>Start</span>
              <input type="datetime-local" className="input" value={f.start} onChange={set('start')} required aria-invalid={!!problem} aria-describedby={problem ? 'time-problem' : undefined} />
            </label>
            <label className="field"><span>End</span>
              <input type="datetime-local" className="input" value={f.end} onChange={set('end')} required aria-invalid={!!problem} aria-describedby={problem ? 'time-problem' : undefined} />
            </label>
            <label className="field"><span>Break (minutes)</span>
              <input type="number" inputMode="numeric" name="break_minutes" min={0} max={480} className="input" value={f.break_minutes} onChange={set('break_minutes')} />
            </label>
            <div className="field"><span>Quick fill</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" onClick={() => setF((x) => ({ ...x, end: nowLocal() }))}>End now</button>
                <button type="button" className="btn btn-sm" onClick={() => setF((x) => ({ ...x, start: ago(60) }))}>Start 1h before end</button>
              </div>
            </div>
          </div>
          {problem && <p id="time-problem" role="alert" className="mt-3 text-[13px] text-bad">{problem}</p>}
          <div className="mt-5 rounded-xl border border-line bg-white/[0.02] p-4 lg:hidden">{summary}</div>
        </section>

        <section className={section} aria-labelledby="sec-report">
          <h2 id="sec-report" className={h}>3 · Report details</h2>
          <div className="grid gap-4">
            <label className="field"><span>Summary</span>
              <textarea name="summary" className="input" maxLength={4000} value={f.summary} onChange={set('summary')}
                placeholder={dept?.division === 'fire_ems' ? 'Station, notable calls, who you rode with' : 'Patrol area, notable calls, who you rode with'} />
              <span className="text-right text-[12px] text-faint">{f.summary.length} / 4000</span>
            </label>
            <label className="field sm:max-w-xs"><span>CAD or call reference (optional)</span>
              <input name="cad_reference" className="input" maxLength={80} value={f.cad_reference} onChange={set('cad_reference')} />
            </label>
          </div>
        </section>

        {(dept?.division === 'leo' || dept?.bodycam_required) && (
          <section className={section} aria-labelledby="sec-evidence">
            <h2 id="sec-evidence" className={h}>4 · Evidence <span className="ml-1 text-[12px] font-normal text-muted">Bodycam{dept?.bodycam_required ? ' · required' : ' · optional'}</span></h2>
            <div className="grid gap-4">
              {dept?.bodycam_policy_text && <p className="text-[13px] leading-relaxed text-muted">{dept.bodycam_policy_text}</p>}
              {dept?.bodycam_policy_url && <a href={dept.bodycam_policy_url} target="_blank" rel="noreferrer" className="text-[13px] text-gold">Read the bodycam policy</a>}
              <div className="grid gap-4 [&>*]:min-w-0 sm:grid-cols-2">
                <label className="field"><span>Footage</span>
                  <select name="bodycam_status" className="input" value={f.bodycam_status} onChange={set('bodycam_status')} required={dept?.bodycam_required}>
                    <option value="">{dept?.bodycam_required ? 'Choose one' : 'Not recorded'}</option>
                    <option value="recorded">Recorded</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </label>
                {f.bodycam_status === 'recorded' && (
                  <label className="field"><span>Bodycam link (proof)</span>
                    <input name="recording_url" type="url" className="input" placeholder="https://" value={f.recording_url} onChange={set('recording_url')} required />
                  </label>
                )}
              </div>
              {f.bodycam_status === 'unavailable' && (
                <label className="field"><span>Why is footage unavailable?</span>
                  <input name="bodycam_explanation" className="input" minLength={10} value={f.bodycam_explanation} onChange={set('bodycam_explanation')} required />
                </label>
              )}
            </div>
          </section>
        )}

        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center md:p-6">
          <button className="btn-primary h-12 sm:h-[42px]" disabled={pending || !!problem}
            onClick={() => { if (intent.current) intent.current.value = 'submit'; }}>{pending ? 'Submitting…' : 'Submit log'}</button>
          <button className="btn h-12 sm:h-[42px]" disabled={pending || !!problem} formNoValidate
            onClick={() => { if (intent.current) intent.current.value = 'draft'; }}>Save draft</button>
          {confirmDiscard ? (
            <span className="flex items-center gap-2 text-[13px] sm:ml-auto">
              <span className="text-muted">Discard everything entered?</span>
              <button type="button" className="btn-danger btn-sm" onClick={() => { clearDraft(); submitting.current = true; location.href = '/hub/shifts'; }}>Discard</button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
            </span>
          ) : (
            <button type="button" className="btn-danger h-12 sm:ml-auto sm:h-[42px]" disabled={pending} onClick={() => setConfirmDiscard(true)}>Discard</button>
          )}
        </div>
      </div>

      <aside className="hidden lg:block" aria-label="Time summary">
        <div className="card sticky top-[88px] p-5 md:p-6"><h2 className={h}>Time summary</h2>{summary}</div>
      </aside>
    </form>
  );
}
