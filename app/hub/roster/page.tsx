import Link from 'next/link';
import { Fragment } from 'react';
import { Emblem } from '@/components/Emblem';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Membership, Rank } from '@/lib/types';

export const metadata = { title: 'Roster' };

export default async function Roster({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  const visible = s.departments.filter((d) => d.active);
  const dept = visible.find((d) => d.key === sp.dept) ?? visible.find((d) => d.key === s.current?.department_key) ?? visible[0];
  const manage = s.canManageRoster(dept.key);

  const [{ data: members }, { data: ranks }] = await Promise.all([
    supabase.from('memberships').select('*').eq('department_key', dept.key).in('status', manage ? ['active', 'suspended', 'pending'] : ['active', 'suspended'])
      .order('display_name').returns<Membership[]>(),
    supabase.from('ranks').select('*').eq('department_key', dept.key).eq('active', true).order('sort_order').returns<Rank[]>(),
  ]);
  const rankOrder = new Map((ranks ?? []).map((r) => [r.id, r.sort_order]));
  const roster = (members ?? []).filter((m) => m.status !== 'pending')
    .sort((a, b) => (rankOrder.get(b.rank_id ?? '') ?? 0) - (rankOrder.get(a.rank_id ?? '') ?? 0) || a.display_name.localeCompare(b.display_name));
  const requests = (members ?? []).filter((m) => m.status === 'pending');
  const onDuty = roster.filter((m) => m.duty_status === 'on_duty' && m.status === 'active').length;
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = q ? roster.filter((m) => [m.display_name, m.callsign, m.badge, m.rank_name].some((v) => v?.toLowerCase().includes(q))) : roster;

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow={`${onDuty} on duty · ${roster.length} listed`} title={`${dept.short_name} roster`}>
        <div className="flex gap-1">
          {visible.map((d) => (
            <Link key={d.key} href={`/hub/roster?dept=${d.key}`}
              className={`rounded-full px-3 py-1.5 text-[13px] ${d.key === dept.key ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{d.short_name}</Link>
          ))}
        </div>
      </PageHead>

      {manage && requests.length > 0 && (
        <Link href={`/hub/command/staff?dept=${dept.key}`} className="card mb-8 flex items-center justify-between gap-3 border-gold/30 px-5 py-4 hover:border-gold/50">
          <span className="text-[14px]"><span className="font-medium text-gold">{requests.length}</span> {requests.length === 1 ? 'person is' : 'people are'} waiting to join {dept.short_name}</span>
          <span className="text-[13px] text-muted">Review on the command staff panel →</span>
        </Link>
      )}

      {roster.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Emblem dept={dept.key} label={dept.short_name} accent={dept.accent} division={dept.division} size={40} />
          <form className="flex min-w-60 flex-1 gap-2">
            <input type="hidden" name="dept" value={dept.key} />
            <input name="q" className="input" defaultValue={sp.q ?? ''} placeholder="Search name, callsign, badge or rank" />
            <button className="btn">Search</button>
          </form>
          {q && <Link href={`/hub/roster?dept=${dept.key}`} className="text-[13px] text-muted hover:text-ink">Clear</Link>}
        </div>
      )}

      {shown.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Callsign</th><th>Name</th><th>Rank</th><th>Duty</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((m, i) => (
                <Fragment key={m.id}>
                {(i === 0 || shown[i - 1].rank_name !== m.rank_name) && !q && (
                  <tr><td colSpan={5} className="!pt-5 !pb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">{m.rank_name ?? 'No rank'}</td></tr>
                )}
                <tr className="hover:bg-white/[0.02]">
                  <td className="font-mono text-[13px] text-gold">{m.callsign ?? '—'}</td>
                  <td>
                    <Link href={`/hub/roster/${m.id}`} className="hover:text-gold">{m.display_name}</Link>
                    {!m.profile_id && <span className="ml-2 text-[12px] text-faint">not linked</span>}
                    {m.leave_until && m.leave_until >= new Date().toISOString().slice(0, 10) && <span className="tag tag-warn ml-2">LOA</span>}
                  </td>
                  <td className="text-muted">{m.rank_name}</td>
                  <td>{m.duty_status === 'on_duty' ? <span className="tag tag-ok"><span className="on-duty-ring h-1.5 w-1.5 rounded-full bg-ok" />On duty</span> : <span className="text-faint">Off</span>}</td>
                  <td>{m.status !== 'active' ? <StatusTag status={m.status} /> : <span className="text-faint">Active</span>}</td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>{q ? 'Nobody matches that search.' : 'No one on this roster yet.'}</Empty>}
      <p className="mt-4 text-[12px] text-faint">Members on leave are marked LOA. Please do not contact them about activity.</p>
    </>
  );
}
