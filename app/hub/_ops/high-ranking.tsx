import Link from 'next/link';
import { Empty, StatusTag } from '@/components/ui';
import { DiscordLink, Panel, ResourceGrid, WorkspaceHeader, type ResourceItem } from '@/components/ops/kit';
import { ACTIVITY_LABEL, relative } from '@/lib/format';
import { canDecide } from '@/lib/queue';
import type { Session } from '@/lib/session';
import { LEADERSHIP, SITE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import type { Tier } from '@/lib/types';
import { can } from '@/lib/workspaces';

type Open = { id: string; ref: string; department_key: string; required_tier: Tier; profile_id: string; status: string; created_at: string; activity_type?: string; title?: string; snapshot_name?: string };

// Only reached after the page checks the supervisor gate. The queue is filtered with the same rule
// the database uses to decide who may act on a row.
export async function HighRankingOverview({ s }: { s: Session }) {
  const supabase = await createClient();
  const [{ data: logs }, { data: subs }] = await Promise.all([
    supabase.from('shift_logs').select('id,ref,department_key,required_tier,profile_id,status,created_at,activity_type,snapshot_name').in('status', ['submitted', 'under_review']).order('created_at').limit(50).returns<Open[]>(),
    supabase.from('submissions').select('id,ref,department_key,required_tier,profile_id,status,created_at,title').in('status', ['submitted', 'under_review']).order('created_at').limit(50).returns<Open[]>(),
  ]);
  const queue = [...(logs ?? []).map((l) => ({ ...l, kind: 'Shift log', href: `/hub/shifts/${l.id}`, label: ACTIVITY_LABEL[l.activity_type ?? ''] ?? 'Shift', who: l.snapshot_name ?? '' })),
    ...(subs ?? []).map((l) => ({ ...l, kind: 'Report', href: `/hub/reports/${l.id}`, label: l.title ?? 'Report', who: '' }))]
    .filter((l) => canDecide(s, l.department_key, l.required_tier, l.profile_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const d = SITE.department;
  const command = can(s, 'command');
  const sheriff = LEADERSHIP[0].leaders.slice(0, 3);
  const tools: ResourceItem[] = [
    { title: 'Roster Updates', desc: 'Review and update the department roster.', icon: 'users', href: '/hub/roster' },
    ...(command ? [{ title: 'Command Resources', desc: 'Panels for staffing, certifications and personnel notes.', icon: 'book', href: '/hub/command' } as ResourceItem] : s.supervised.length ? [{ title: 'Supervisor panel', desc: 'Staffing and queues for your department.', icon: 'book', href: '/hub/command' } as ResourceItem] : []),
    ...(command ? [{ title: 'High Command Tools', desc: 'Authorized leadership tools and approvals.', icon: 'key', href: '/hub/high-ranking/tools' } as ResourceItem] : []),
  ];

  return (
    <>
      <WorkspaceHeader title="High Ranking" description="Authorized leadership resources and operations." restricted="Restricted access" />
      <section className="mb-5 rounded-[14px] border border-line-strong p-5 md:min-h-[140px]" style={{ background: 'linear-gradient(120deg, #101f35 0%, #173d32 100%)' }}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="text-[18px] font-semibold">Leadership overview</h2>
            <p className="mt-1 text-[13px] text-ink/80">You are signed in with {s.canManageRoster(d) ? 'command access' : 'supervisor access'}. The review queue below holds only items you are allowed to decide.</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">{sheriff.map((l) => <li key={l.callsign}><span className="text-ink">{l.name ?? 'Vacant'}</span> · {l.rank}</li>)}</ul>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/hub/approvals" className="btn-primary">Open approvals{queue.length ? ` (${queue.length})` : ''}</Link></div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
          <Panel title="Review queue" action={<Link href="/hub/approvals" className="text-[13px] text-gold">All approvals</Link>}>
            {queue.length ? (
              <ul className="divide-y divide-line">
                {queue.slice(0, 8).map((q) => (
                  <li key={q.id}>
                    <Link href={q.href} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:text-gold">
                      <span className="min-w-0"><span className="block truncate text-[14px] font-medium">{q.label}</span>
                        <span className="text-[12px] text-faint">{q.kind} · {q.ref} · waiting {relative(q.created_at).replace(/ ago$/, '')}</span></span>
                      <StatusTag status={q.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>Nothing is waiting for you to review.</Empty>}
          </Panel>
        </div>
        <div className="order-1 grid min-w-0 content-start gap-4 lg:order-2 lg:col-span-5">
          <Panel title="Announcements and information">
            <ul className="grid gap-2 text-[14px]">
              {command && <li><DiscordLink channel="command-announcements" className="flex min-h-10 items-center justify-between rounded-lg border border-line px-3 hover:border-line-strong" label="Command Announcements" /></li>}
              <li><DiscordLink channel="sv-announcements" className="flex min-h-10 items-center justify-between rounded-lg border border-line px-3 hover:border-line-strong" label="Supervisor Announcements" /></li>
              <li><DiscordLink channel="sv-info" className="flex min-h-10 items-center justify-between rounded-lg border border-line px-3 hover:border-line-strong" label="Supervisor Information" /></li>
            </ul>
          </Panel>
        </div>
      </div>

      <section className="mt-8"><h2 className="mb-4 text-[17px] font-semibold">Leadership tools</h2><ResourceGrid items={tools} /></section>

      <section className="mt-8">
        <h2 className="mb-3 text-[17px] font-semibold">Communication</h2>
        <div className="flex flex-wrap gap-2">
          {command && <DiscordLink channel="command-chat" label="Command Chat" />}
          <DiscordLink channel="supervisor-chat" label="Supervisor Chat" />
        </div>
        <p className="mt-2 text-[12px] text-faint">Chats stay in Discord. The hub does not read or copy their messages.</p>
      </section>
    </>
  );
}
