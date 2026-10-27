import { decideSubmission } from '@/app/hub/actions';
import type { Submission } from '@/lib/types';

export function SubmissionDecision({ sub, back, canEscalate }: { sub: Submission; back: string; canEscalate: boolean }) {
  return (
    <form className="grid gap-3">
      <input type="hidden" name="id" value={sub.id} />
      <input type="hidden" name="back" value={back} />
      <label className="field"><span>Note to the member (required to return or deny)</span>
        <input name="reason" className="input" maxLength={600} placeholder="What to correct, or why" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button formAction={decideSubmission.bind(null, 'approve')} className="btn-primary btn-sm">Approve</button>
        <button formAction={decideSubmission.bind(null, 'return')} className="btn btn-sm">Return for correction</button>
        <button formAction={decideSubmission.bind(null, 'deny')} className="btn-danger btn-sm">Deny</button>
        {sub.status === 'submitted' && <button formAction={decideSubmission.bind(null, 'claim')} className="btn btn-sm">Claim</button>}
        {canEscalate && sub.required_tier !== 'dps' && <button formAction={decideSubmission.bind(null, 'escalate')} className="btn btn-sm">Escalate to command</button>}
      </div>
    </form>
  );
}
