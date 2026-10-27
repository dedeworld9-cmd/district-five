import { requestMembership } from '@/app/hub/actions';
import type { Department } from '@/lib/types';
import { Emblem } from './Emblem';

// Roster request. The roleplay name becomes the member's display name on the roster.
export function JoinForm({ joinable, preselect, name, back }: { joinable: Department[]; preselect?: string; name: string; back: string }) {
  return (
    <form action={requestMembership} className="card grid gap-4 p-6 sm:grid-cols-2">
      <input type="hidden" name="back" value={back} />
      <div className="sm:col-span-2">
        <div className="text-[16px] font-medium">Request to join a department</div>
        <p className="mt-1 text-[13px] text-muted">Command reviews every request. If you are already on a roster, command can link your Discord account instead.</p>
      </div>
      <fieldset className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        <legend className="mb-2 text-[13px] text-muted">Department</legend>
        {joinable.map((d, i) => (
          <label key={d.key} className="card-hover flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-bg/40 p-3 has-[:checked]:border-[color:var(--c)] has-[:checked]:bg-white/[0.04]"
            style={{ '--c': d.accent } as React.CSSProperties}>
            <input type="radio" name="department" value={d.key} required className="sr-only"
              defaultChecked={joinable.some((x) => x.key === preselect) ? d.key === preselect : i === 0} />
            <Emblem dept={d.key} label={d.short_name} accent={d.accent} division={d.division} size={40} />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium">{d.short_name}</span>
              <span className="block truncate text-[12px] text-muted">{d.name}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="field"><span>Roleplay name</span>
        <input name="rp_name" className="input" required minLength={2} maxLength={60} defaultValue={name} placeholder="e.g. John Carter" />
      </label>
      <label className="field"><span>Previous experience?</span>
        <select name="experience" className="input" required defaultValue="">
          <option value="" disabled>Choose one</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </label>
      <label className="field sm:col-span-2"><span>Anything else for command (optional)</span>
        <textarea name="note" className="input" maxLength={500} placeholder="Where you served before, who recruited you, transfer details" />
      </label>
      <div className="sm:col-span-2"><button className="btn-primary">Send request</button></div>
    </form>
  );
}
