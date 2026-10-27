import { decideShift } from '@/app/hub/actions';
import type { ShiftLog } from '@/lib/types';

export function DecisionPanel({ log, back, canEscalate }: { log: ShiftLog; back: string; canEscalate: boolean }) {
  return (
    <form className="grid gap-3">
      <input type="hidden" name="id" value={log.id} />
      <input type="hidden" name="back" value={back} />
      <label className="field"><span>Note to the member (required to return or deny)</span>
        <input name="reason" className="input" maxLength={600} placeholder="What to correct, or why" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button formAction={decideShift.bind(null, 'approve')} className="btn-primary btn-sm">Approve</button>
        <button formAction={decideShift.bind(null, 'return')} className="btn btn-sm">Return for correction</button>
        <button formAction={decideShift.bind(null, 'deny')} className="btn-danger btn-sm">Deny</button>
        {log.status === 'submitted' && <button formAction={decideShift.bind(null, 'claim')} className="btn btn-sm">Claim</button>}
        {canEscalate && log.required_tier !== 'dps' && <button formAction={decideShift.bind(null, 'escalate')} className="btn btn-sm">Escalate to command</button>}
      </div>
    </form>
  );
}
