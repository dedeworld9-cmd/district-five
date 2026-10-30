import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AccessDenied, DiscordLink, ListGroup, Panel, ResourceGrid, WorkspaceHeader, type ResourceItem } from '@/components/ops/kit';
import { channelName } from '@/lib/discord';
import { requireSession } from '@/lib/session';
import { MASS_SHIFT_REWARDS } from '@/lib/site';
import { WS, can, pageHref } from '@/lib/workspaces';

type P = { ws: string; page: string };
const find = ({ ws, page }: P) => { const w = WS[ws]; const p = w?.pages.find((x) => x.slug === page); return w && p ? { w, p } : null; };

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const f = find(await params);
  return { title: f?.p.label ?? 'Hub' };
}

// Pages that live in Discord get a gateway: what the page is, a verified link, and anything the hub
// itself offers alongside it. Native pages redirect to their own route. Gates are checked here.
export default async function Gateway({ params }: { params: Promise<P> }) {
  const f = find(await params);
  if (!f) notFound();
  const { w, p } = f;
  const s = await requireSession();
  if (!can(s, w.gate)) return <AccessDenied gate={w.gate} />;
  if (!can(s, p.gate)) return <AccessDenied gate={p.gate} />;
  if (p.href) redirect(pageHref(w, p));

  if (p.slug === 'tools') {
    const d = 'hcso';
    const items: ResourceItem[] = [
      ...(s.supervised.length || s.isDps ? [{ title: 'Approvals', desc: 'Decide on shift logs and reports waiting for review.', icon: 'list', href: '/hub/approvals' } as ResourceItem] : []),
      ...(s.supervised.length ? [{ title: 'Panels', desc: 'Staffing, queues and certifications for your department.', icon: 'book', href: '/hub/command' } as ResourceItem] : []),
      ...(s.canManageRoster(d) ? [{ title: 'Roster', desc: 'Promote, suspend and manage members.', icon: 'users', href: '/hub/roster' } as ResourceItem] : []),
      ...(s.canAdminister(d) ? [{ title: 'Department settings', desc: 'Ranks, options, policies and announcements.', icon: 'key', href: '/hub/admin' } as ResourceItem] : []),
      { title: '#hicom-commands', desc: 'High command commands channel in Discord.', icon: 'shield', channel: 'hicom-commands' },
    ];
    return (
      <>
        <WorkspaceHeader title={p.label} description={p.desc} restricted="Command only" />
        <ResourceGrid items={items} />
        <p className="mt-4 text-[12px] text-faint">Each action is checked again by the database when you use it. Seeing a tool here is not permission to use it.</p>
      </>
    );
  }

  const ch = p.channel;
  return (
    <>
      <WorkspaceHeader title={p.label} description={p.desc} restricted={w.gate !== 'member' || p.gate !== 'member' ? 'Restricted access' : undefined}>
        {ch && <DiscordLink channel={ch} className="btn-primary" label={`Open #${channelName(ch)}`} />}
      </WorkspaceHeader>
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel title="Where this lives" className="lg:col-span-7">
          <p className="text-[14px] leading-relaxed text-muted">
            {p.label} is handled in the HCSO Discord, so this page is a shortcut rather than a copy. The hub does not read or mirror Discord messages.
            The link opens only for members who can see the channel in Discord.
          </p>
          {ch && <div className="mt-5"><DiscordLink channel={ch} className="btn-primary h-12 w-full sm:h-[42px] sm:w-auto" label={`Open #${channelName(ch)} in Discord`} /></div>}
          {p.slug === 'mass-shifts' && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="mb-3 text-[14px] font-medium">Rewards listed by the department</h3>
              <ul className="flex flex-wrap gap-1.5">{MASS_SHIFT_REWARDS.map((r) => <li key={r} className="tag">{r}</li>)}</ul>
            </div>
          )}
        </Panel>
        <Panel title="Related" className="lg:col-span-5">
          <ListGroup label="Related" rows={[
            ...(p.also ?? []).filter((a) => can(s, a.gate ?? 'member')).map((a) => ({ label: a.label, channel: a.channel, href: a.href })),
            { label: `Back to ${w.label}`, href: `/hub/${w.slug}` },
          ]} />
        </Panel>
      </div>
    </>
  );
}
