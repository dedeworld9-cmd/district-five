import { adminSaveOption, adminSaveRank, adminUpdateDepartment } from '@/app/hub/actions';
import { TIERS, TIER_LABEL } from '@/lib/tiers';
import type { Department, DepartmentOption, Rank, Tier } from '@/lib/types';

// Department settings, rank ladder and request options. Shared by the site Admin page
// and each department's Administration panel; the database checks who may save.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'UTC'];

export function DeptSettingsForm({ d, back, title = d.name }: { d: Department; back: string; title?: string }) {
  return (
    <form action={adminUpdateDepartment} className="card grid gap-4 p-6 sm:grid-cols-3">
      <input type="hidden" name="key" value={d.key} />
      <input type="hidden" name="back" value={back} />
      <h2 className="text-[16px] font-medium sm:col-span-3">{title}</h2>
      <label className="field"><span>Weekly quota (hours)</span>
        <input name="quota_hours" type="number" min={0} max={168} step={0.5} className="input" defaultValue={d.quota_minutes / 60} />
      </label>
      <label className="field"><span>Week starts on</span>
        <select name="week_starts_on" className="input" defaultValue={d.week_starts_on}>
          {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
        </select>
      </label>
      <label className="field"><span>Time zone for weeks</span>
        <select name="timezone" className="input" defaultValue={d.timezone}>
          {[...new Set([d.timezone, ...ZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[14px] text-muted sm:col-span-3">
        <input type="checkbox" name="bodycam_required" defaultChecked={d.bodycam_required} /> Require a bodycam status on every submitted shift
      </label>
      <label className="field sm:col-span-2"><span>Bodycam policy text shown on the shift form (paste your department&apos;s wording)</span>
        <textarea name="bodycam_policy_text" className="input" defaultValue={d.bodycam_policy_text ?? ''} rows={3} />
      </label>
      <label className="field"><span>Policy link</span>
        <input name="bodycam_policy_url" type="url" className="input" defaultValue={d.bodycam_policy_url ?? ''} placeholder="https://" />
      </label>
      <div className="sm:col-span-3"><button className="btn-primary btn-sm">Save {d.short_name}</button></div>
    </form>
  );
}

export function RankEditor({ d, ranks, back, tiers = TIERS }: { d: Department; ranks: Rank[]; back: string; tiers?: Tier[] }) {
  return (
    <div className="card divide-y divide-line">
      {ranks.map((r) => {
        const locked = !tiers.includes(r.tier);
        return (
          <form key={r.id} action={adminSaveRank} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_2fr_1fr_1.4fr_auto_auto]">
            <input type="hidden" name="id" value={r.id} /><input type="hidden" name="department" value={d.key} />
            <input type="hidden" name="back" value={back} />
            <input name="sort_order" type="number" className="input !h-8" defaultValue={r.sort_order} aria-label="Order" disabled={locked} />
            <input name="name" className="input !h-8" defaultValue={r.name} aria-label="Rank name" disabled={locked} />
            <input name="abbreviation" className="input !h-8" defaultValue={r.abbreviation ?? ''} aria-label="Abbreviation" disabled={locked} />
            <select name="tier" className="input !h-8" defaultValue={r.tier} aria-label="Tier" disabled={locked}>
              {(locked ? [r.tier] : tiers).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select>
            {r.is_sample ? <span className="tag">sample</span> : <span className="tag tag-ok">confirmed</span>}
            {locked ? <span className="text-[12px] text-faint">Division command</span> : <button className="btn btn-sm">Save</button>}
          </form>
        );
      })}
      <form action={adminSaveRank} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_2fr_1fr_1.4fr_auto]">
        <input type="hidden" name="department" value={d.key} />
        <input type="hidden" name="back" value={back} />
        <input name="sort_order" type="number" className="input !h-8" placeholder="#" aria-label="Order" />
        <input name="name" className="input !h-8" placeholder="New rank" required aria-label="Rank name" />
        <input name="abbreviation" className="input !h-8" placeholder="Abbr." aria-label="Abbreviation" />
        <select name="tier" className="input !h-8" defaultValue="patrol" aria-label="Tier">
          {tiers.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
        </select>
        <button className="btn btn-sm">Add</button>
      </form>
    </div>
  );
}

export function OptionEditor({ d, options, back }: { d: Department; options: DepartmentOption[]; back: string }) {
  return (
    <div className="card divide-y divide-line">
      {options.map((o) => (
        <form key={o.id} action={adminSaveOption} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_7rem_2fr_1.4fr_auto_auto_auto]">
          <input type="hidden" name="id" value={o.id} /><input type="hidden" name="department" value={d.key} />
          <input type="hidden" name="kind" value={o.kind} /><input type="hidden" name="back" value={back} />
          <input name="sort_order" type="number" className="input !h-8" defaultValue={o.sort_order} aria-label="Order" />
          <span className="text-[12px] text-faint">{o.kind === 'certification' ? 'Certification' : 'Subdivision'}</span>
          <input name="name" className="input !h-8" defaultValue={o.name} aria-label="Name" />
          <select name="min_tier" className="input !h-8" defaultValue={o.min_tier} aria-label="Lowest tier that may request">
            {TIERS.map((t) => <option key={t} value={t}>From {TIER_LABEL[t].toLowerCase()}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-muted"><input type="checkbox" name="is_open" defaultChecked={o.is_open} /> Open</label>
          <select name="active" className="input !h-8" defaultValue={o.active ? 'on' : 'off'} aria-label="Listed">
            <option value="on">Listed</option><option value="off">Hidden</option>
          </select>
          <button className="btn btn-sm">Save</button>
        </form>
      ))}
      <form action={adminSaveOption} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_7rem_2fr_1.4fr_auto_auto]">
        <input type="hidden" name="department" value={d.key} /><input type="hidden" name="back" value={back} />
        <input name="sort_order" type="number" className="input !h-8" placeholder="#" aria-label="Order" />
        <select name="kind" className="input !h-8" defaultValue="certification" aria-label="Kind">
          <option value="certification">Certification</option><option value="subdivision">Subdivision</option>
        </select>
        <input name="name" className="input !h-8" placeholder="New option" required aria-label="Name" />
        <select name="min_tier" className="input !h-8" defaultValue="probationary" aria-label="Lowest tier that may request">
          {TIERS.map((t) => <option key={t} value={t}>From {TIER_LABEL[t].toLowerCase()}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-muted"><input type="checkbox" name="is_open" defaultChecked /> Open</label>
        <button className="btn btn-sm">Add</button>
      </form>
    </div>
  );
}
