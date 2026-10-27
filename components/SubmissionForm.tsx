'use client';

import { useActionState, useRef, useState } from 'react';
import { saveSubmission, type SubmissionFormState } from '@/app/hub/actions';
import { KIND } from '@/lib/kinds';

export interface SubmissionDept { key: string; short_name: string }
export interface SubmissionInitial {
  id?: string; version?: number; department: string; details?: Record<string, string>;
  evidence_url?: string | null; occurred_on?: string | null; expires_at?: string | null; subject?: string | null;
}

// datetime-local works in the browser's time zone; the database stores UTC.
const toLocal = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function SubmissionForm({ kind, depts, options, subjects, initial, lockedDepartment, preview }: {
  kind: string;
  depts: SubmissionDept[];
  /** Certification or subdivision names per department. */
  options: Record<string, string[]>;
  /** Probationary members per department, for FTO logs. */
  subjects: Record<string, { id: string; name: string }[]>;
  initial: SubmissionInitial;
  lockedDepartment?: boolean;
  /** Shown to command without a department membership; nothing can be saved. */
  preview?: boolean;
}) {
  const cfg = KIND[kind];
  const [state, action, pending] = useActionState<SubmissionFormState, FormData>(saveSubmission, {});
  const intent = useRef<HTMLInputElement>(null);
  const [dept, setDept] = useState(initial.department);
  const [expires, setExpires] = useState(toLocal(initial.expires_at));
  const v = (name: string) => initial.details?.[name] ?? '';
  const short = depts.find((d) => d.key === dept)?.short_name ?? dept;

  return (
    <form action={action} className="card grid gap-6 p-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.version && <input type="hidden" name="version" value={initial.version} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="intent" ref={intent} defaultValue="draft" />
      {cfg.expires && <input type="hidden" name="expires_at" value={expires ? new Date(expires).toISOString() : ''} />}
      {(lockedDepartment || depts.length < 2) && <input type="hidden" name="department" value={dept} />}

      {state.error && <p role="alert" data-flash="error" className="rounded-lg border border-bad/30 px-3 py-2 text-[14px] text-bad">{state.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {depts.length > 1 && !lockedDepartment ? (
          <label className="field"><span>Department</span>
            <select name="department" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
              {depts.map((d) => <option key={d.key} value={d.key}>{d.short_name}</option>)}
            </select>
          </label>
        ) : (
          <div className="field"><span>Department</span><div className="input flex items-center text-muted">{short}</div></div>
        )}
        {cfg.occurred && (
          <label className="field"><span>{cfg.occurred}</span>
            <input type="date" name="occurred_on" className="input" defaultValue={initial.occurred_on ?? ''} required />
          </label>
        )}
        {cfg.expires && (
          <label className="field"><span>Requested expiration</span>
            <input type="datetime-local" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} required />
          </label>
        )}
        {cfg.subject && (
          <label className="field"><span>Probationary member</span>
            <select name="subject" className="input" defaultValue={initial.subject ?? ''} required key={dept}>
              <option value="">{subjects[dept]?.length ? 'Choose a member' : 'No probationary members'}</option>
              {(subjects[dept] ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cfg.fields.map((f) => {
          const list = f.optionsFrom ? options[dept] ?? [] : f.options ?? [];
          const name = `f_${f.name}`;
          const label = <span>{f.label}{f.required ? '' : ' (optional)'}</span>;
          const cls = `field ${f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}`;
          if (f.type === 'select') {
            return (
              <label key={f.name + dept} className={`field ${f.wide ? 'sm:col-span-2' : ''}`}>{label}
                <select name={name} className="input" defaultValue={v(f.name)} required={f.required}>
                  <option value="">{list.length ? 'Choose one' : 'None offered right now'}</option>
                  {list.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          if (f.type === 'textarea') {
            return (
              <label key={f.name} className={cls}>{label}
                <textarea name={name} className="input" maxLength={4000} rows={f.wide ? 5 : 3} defaultValue={v(f.name)} required={f.required} placeholder={f.placeholder} />
              </label>
            );
          }
          return (
            <label key={f.name} className={`field ${f.wide ? 'sm:col-span-2' : ''}`}>{label}
              <input name={name} type={f.type === 'date' ? 'date' : 'text'} className="input" maxLength={300} defaultValue={v(f.name)}
                required={f.required} placeholder={f.placeholder} />
            </label>
          );
        })}
        {cfg.evidence && (
          <label className="field sm:col-span-2"><span>{cfg.evidence.label}</span>
            <input name="evidence_url" type="url" className="input" placeholder="https://" defaultValue={initial.evidence_url ?? ''} required={cfg.evidence.required} />
          </label>
        )}
      </div>

      {cfg.notice && <p className="text-[13px] leading-relaxed text-muted">{cfg.notice}</p>}

      <div className="flex flex-wrap gap-2 border-t border-line pt-6">
        <button className="btn-primary" disabled={pending || preview}
          onClick={() => { if (intent.current) intent.current.value = 'submit'; }}>Submit for review</button>
        <button className="btn" disabled={pending || preview} formNoValidate
          onClick={() => { if (intent.current) intent.current.value = 'draft'; }}>Save draft</button>
      </div>
    </form>
  );
}
