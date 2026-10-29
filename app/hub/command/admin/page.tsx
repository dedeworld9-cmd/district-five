import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DeptSettingsForm, OptionEditor, RankEditor } from '@/components/DeptAdmin';
import { PanelTabs } from '@/components/PanelTabs';
import { Empty, Flash, PageHead } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { panelDepts } from '@/lib/panels';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIERS, TIER_LABEL, tierRank } from '@/lib/tiers';
import type { DepartmentOption, Rank, Tier } from '@/lib/types';
import { adminSaveRoute } from '../../actions';

export const metadata = { title: 'Administration panel' };

const TABS = [['access', 'Roles & access'], ['settings', 'Settings'], ['ranks', 'Ranks'], ['options', 'Certifications'], ['routing', 'Review routing'], ['audit', 'Audit log']] as const;

// What each tier can do, top to bottom. Kept in step with the database checks.
const ACCESS: { tier: Tier; can: string }[] = [
  { tier: 'probationary', can: 'Log shifts and file reports. Probationary logs and reports go to a supervisor.' },
  { tier: 'patrol', can: 'Everything above, plus requests for certifications and subdivisions.' },
  { tier: 'supervisor', can: 'Supervisor panel: approve shift logs and reports from patrol and probationary members, see activity and quota.' },
  { tier: 'high_command', can: 'Command staff panel: accept or deny join requests, promote, suspend and set leave below their own rank, decide roster updates, add members.' },
  { tier: 'department_head', can: 'Administration panel: quota, bodycam rules, rank ladder, certifications, review routing and the audit log. Approves posts for the public site.' },
];

interface Route { id: string; record_type: string; department_key: string | null; submitter_tier: Tier; required_tier: Tier }
interface Audit { id: number; actor_name: string | null; action: string; entity_ref: string | null; created_at: string }

export default async function AdminPanel({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const { list: depts, dept } = panelDepts(s, 'admin', sp.dept);
  if (!dept) redirect('/hub/command');
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'access';
  const back = `/hub/command/admin?dept=${dept.key}&tab=${tab}`;
  const supabase = await createClient();
  const [{ data: ranks }, { data: options }, { data: routes }, { data: audit }] = await Promise.all([
    supabase.from('ranks').select('*').eq('department_key', dept.key).order('sort_order').returns<Rank[]>(),
    supabase.from('department_options').select('*').eq('department_key', dept.key).order('kind').order('sort_order').order('name').returns<DepartmentOption[]>(),
    supabase.from('approval_routes').select('*').eq('record_type', 'shift_log').or(`department_key.is.null,department_key.eq.${dept.key}`).returns<Route[]>(),
    tab === 'audit' ? supabase.from('audit_log').select('id,actor_name,action,entity_ref,created_at').eq('department_key', dept.key)
      .order('created_at', { ascending: false }).limit(100).returns<Audit[]>() : Promise.resolve({ data: [] as Audit[] }),
  ]);
  // Department heads cannot hand out division command; only DPS or Fire/EMS command and admins can.
  const tiers = s.oversees(dept.key) || s.isAdmin ? TIERS : TIERS.filter((t) => t !== 'dps');
  const ladder = [...(ranks ?? [])].filter((r) => r.active).sort((a, b) => b.sort_order - a.sort_order);
  const own = (routes ?? []).filter((r) => r.department_key === dept.key);
  const routeFor = (t: Tier) => own.find((r) => r.submitter_tier === t) ?? (routes ?? []).find((r) => !r.department_key && r.submitter_tier === t);

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow={dept.name} title="Administration panel" />
      <PanelTabs s={s} panel="admin" dept={dept} depts={depts} />
      <div className="mb-8 flex flex-wrap gap-1">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/hub/command/admin?dept=${dept.key}&tab=${k}`}
            className={`rounded-full px-3 py-1.5 text-[13px] ${tab === k ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{l}</Link>
        ))}
      </div>

      {tab === 'access' && (
        <div className="grid gap-4">
          <p className="max-w-2xl text-[14px] text-muted">
            A member&apos;s rank sets their tier, and the tier opens the panels. Each tier keeps everything below it.
            Change a rank&apos;s tier on the Ranks tab. Nobody can approve their own entry.
          </p>
          <div className="card divide-y divide-line">
            {[...ACCESS].reverse().map((a) => {
              const list = ladder.filter((r) => r.tier === a.tier);
              return (
                <div key={a.tier} className="grid gap-2 px-5 py-4 sm:grid-cols-[220px_1fr] sm:gap-6">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--theme-a)]">{TIER_LABEL[a.tier]}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-faint">{list.length ? list.map((r) => r.abbreviation || r.name).join(' · ') : 'No ranks at this tier'}</div>
                  </div>
                  <p className="text-[14px] leading-relaxed text-muted">{a.can}</p>
                </div>
              );
            })}
            <div className="grid gap-2 px-5 py-4 sm:grid-cols-[220px_1fr] sm:gap-6">
              <div className="text-[14px] font-medium">Division command</div>
              <p className="text-[14px] leading-relaxed text-muted">Opens every panel in the departments they oversee.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && <DeptSettingsForm d={dept} back={back} title={`${dept.short_name} settings`} />}

      {tab === 'ranks' && (
        <div className="grid gap-4">
          <p className="max-w-2xl text-[14px] text-muted">
            The ladder, lowest first. The tier decides which panels a rank opens and what it can approve. Saving a rank confirms it.
          </p>
          <RankEditor d={dept} ranks={ranks ?? []} back={back} tiers={tiers} />
        </div>
      )}

      {tab === 'options' && (
        <div className="grid gap-4">
          <p className="max-w-2xl text-[14px] text-muted">
            What {dept.short_name} members can request on the Reports page. Approving a certification adds it to the member&apos;s training record.
          </p>
          <OptionEditor d={dept} options={options ?? []} back={back} />
        </div>
      )}

      {tab === 'routing' && (
        <div className="grid max-w-3xl gap-6">
          <p className="text-[14px] text-muted">Who reviews a {dept.short_name} shift log, by the submitter&apos;s tier. Rows marked district default apply until you set your own.</p>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Submitter</th><th>Reviewed by</th><th>Rule</th></tr></thead>
              <tbody>
                {TIERS.filter((t) => routeFor(t)).sort((a, b) => tierRank(a) - tierRank(b)).map((t) => {
                  const r = routeFor(t)!;
                  return (
                    <tr key={t}><td>{TIER_LABEL[t]}</td><td>{TIER_LABEL[r.required_tier]}</td>
                      <td className="text-muted">{r.department_key ? dept.short_name : 'District default'}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <form action={adminSaveRoute} className="card grid gap-3 p-6 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="department" value={dept.key} />
            <input type="hidden" name="back" value={back} />
            <label className="field"><span>Submitter</span>
              <select name="submitter" className="input">{TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
            </label>
            <label className="field"><span>Reviewed by</span>
              <select name="required" className="input" defaultValue="supervisor">{TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
            </label>
            <button className="btn-primary btn-sm">Save rule</button>
          </form>
        </div>
      )}

      {tab === 'audit' && (audit?.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-muted">{dateTime(a.created_at, dept.timezone)}</td>
                  <td>{a.actor_name}</td><td className="font-mono text-[13px]">{a.action}</td>
                  <td className="text-muted">{a.entity_ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No changes recorded for {dept.short_name} yet.</Empty>)}
    </>
  );
}
