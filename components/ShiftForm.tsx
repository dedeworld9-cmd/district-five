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
        next = { ...next, ...JSON.parse(saved) };
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

  if (!mounted) return <div className="card h-96 animate-pulse" />;

  return (
    <form action={(fd) => { clearDraft(); return action(fd); }} className="card grid gap-6 p-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.version && <input type="hidden" name="version" value={initial.version} />}
      <input type="hidden" name="intent" ref={intent} defaultValue="draft" />
      <input type="hidden" name="started_at" value={toIso(f.start)} />
      <input type="hidden" name="ended_at" value={toIso(f.end)} />
      {lockedDepartment && <input type="hidden" name="department" value={f.department} />}

      {restored && (
        <p className="rounded-lg border border-line-strong px-3 py-2 text-[13px] text-muted">
          Restored unsaved changes from this browser.{' '}
          <button type="button" className="text-gold" onClick={() => { clearDraft(); location.reload(); }}>Discard them</button>
        </p>
      )}
      {state.error && <p role="alert" data-flash="error" className="rounded-lg border border-bad/30 px-3 py-2 text-[14px] text-bad">{state.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
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
        <label className="field"><span>Start</span>
          <input type="datetime-local" className="input" value={f.start} onChange={set('start')} required />
        </label>
        <label className="field"><span>End</span>
          <input type="datetime-local" className="input" value={f.end} onChange={set('end')} required />
        </label>
        <label className="field"><span>Break (minutes)</span>
          <input type="number" name="break_minutes" min={0} max={480} className="input" value={f.break_minutes} onChange={set('break_minutes')} />
        </label>
        <div className="field"><span>Counts as</span>
          <div className={`input flex items-center ${problem ? 'text-bad' : ''}`}>
            {minutes === null ? '—' : problem ? 'Check times' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
          </div>
        </div>
      </div>
      {problem && <p className="-mt-3 text-[13px] text-bad">{problem}</p>}

      <label className="field"><span>Summary</span>
        <textarea name="summary" className="input" maxLength={4000} value={f.summary} onChange={set('summary')}
          placeholder={dept?.division === 'fire_ems' ? 'Station, notable calls, who you rode with' : 'Patrol area, notable calls, who you rode with'} />
      </label>
      <label className="field sm:max-w-xs"><span>CAD or call reference (optional)</span>
        <input name="cad_reference" className="input" maxLength={80} value={f.cad_reference} onChange={set('cad_reference')} />
      </label>

      {(dept?.division === 'leo' || dept?.bodycam_required) && <fieldset className="grid gap-4 border-t border-line pt-6">
        <legend className="label mb-2">Bodycam{dept?.bodycam_required ? ' · required' : ' · optional'}</legend>
        {dept?.bodycam_policy_text && <p className="text-[13px] leading-relaxed text-muted">{dept.bodycam_policy_text}</p>}
        {dept?.bodycam_policy_url && <a href={dept.bodycam_policy_url} target="_blank" rel="noreferrer" className="text-[13px] text-gold">Read the bodycam policy</a>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field"><span>Footage</span>
            <select name="bodycam_status" className="input" value={f.bodycam_status} onChange={set('bodycam_status')} required={dept?.bodycam_required}>
              <option value="">{dept?.bodycam_required ? 'Choose one' : 'Not recorded'}</option>
              <option value="recorded">Recorded</option>
              <option value="unavailable">Unavailable</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </label>
          {f.bodycam_status === 'recorded' && (
            <label className="field"><span>Recording link</span>
              <input name="recording_url" type="url" className="input" placeholder="https://" value={f.recording_url} onChange={set('recording_url')} required />
            </label>
          )}
        </div>
        {f.bodycam_status === 'unavailable' && (
          <label className="field"><span>Why is footage unavailable?</span>
            <input name="bodycam_explanation" className="input" minLength={10} value={f.bodycam_explanation} onChange={set('bodycam_explanation')} required />
          </label>
        )}
      </fieldset>}

      <div className="flex flex-wrap gap-2 border-t border-line pt-6">
        <button className="btn-primary" disabled={pending || !!problem}
          onClick={() => { if (intent.current) intent.current.value = 'submit'; }}>Submit for review</button>
        <button className="btn" disabled={pending || !!problem} formNoValidate
          onClick={() => { if (intent.current) intent.current.value = 'draft'; }}>Save draft</button>
        <span className="self-center text-[12px] text-faint">Unsaved changes are kept in this browser until you save.</span>
      </div>
    </form>
  );
}
