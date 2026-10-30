import Link from 'next/link';
import { Empty } from '@/components/ui';
import { DiscordLink, Panel, ResourceGrid, WorkspaceHeader, type ResourceItem } from '@/components/ops/kit';
import { dateOnly } from '@/lib/format';
import type { Session } from '@/lib/session';
import { LEADERSHIP, MASS_SHIFT_REWARDS, SITE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import type { Announcement, Policy } from '@/lib/types';

export async function DepartmentOverview({ s }: { s: Session }) {
  const supabase = await createClient();
  const dept = SITE.department;
  const [{ data: news }, { data: sops }] = await Promise.all([
    supabase.from('announcements').select('*').eq('status', 'published').eq('department_key', dept)
      .order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(6).returns<Announcement[]>(),
    supabase.from('policies').select('id,ref,title,category,summary,source_url,status').eq('department_key', dept).eq('status', 'approved')
      .order('title').limit(6).returns<Policy[]>(),
  ]);
  const featured = (news ?? []).find((n) => n.pinned || n.priority !== 'normal') ?? null;
  const rest = (news ?? []).filter((n) => n.id !== featured?.id).slice(0, 5);
  const office = LEADERSHIP.find((g) => g.group === 'Office of the Sheriff')?.leaders ?? [];

  const resources: ResourceItem[] = [
    ...(sops ?? []).slice(0, 5).map((p): ResourceItem => ({ title: p.title, desc: p.summary ?? 'Standard operating procedure.', icon: 'doc', href: p.source_url ?? undefined, tag: 'SOP' })),
    { title: 'Resources channel', desc: 'Guides and documents shared by command in Discord.', icon: 'book', channel: 'resources' },
  ];

  return (
    <>
      <WorkspaceHeader title="Department Hub" description="Official announcements, mass shifts, command information and resources.">
        <Link href="/hub/resources" className="btn">All resources</Link>
      </WorkspaceHeader>

      <section className="relative mb-5 overflow-hidden rounded-[14px] border border-line bg-raised p-5 md:p-6">
        <div className="absolute inset-y-0 left-0 w-[3px] bg-brand" aria-hidden="true" />
        {featured ? (
          <div className="relative max-w-3xl">
            <div className="text-[12px] link">{featured.priority === 'urgent' ? 'Urgent announcement' : featured.pinned ? 'Pinned announcement' : 'Important announcement'}</div>
            <h2 className="mt-2 text-[22px] leading-snug font-semibold md:text-[26px]">{featured.title}</h2>
            <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink/80">{featured.body}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/hub/announcements" className="btn-primary">View announcement</Link>
              <span className="text-[12px] text-muted">{featured.published_at ? dateOnly(featured.published_at) : ''}{featured.author_name ? ` · ${featured.author_name}` : ''}</span>
            </div>
          </div>
        ) : (
          <div className="relative max-w-3xl">
            <div className="text-[12px] link">Welcome</div>
            <h2 className="mt-2 text-[22px] leading-snug font-semibold md:text-[26px]">{SITE.name}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{SITE.welcome} No featured announcement is posted right now. Standard operating procedures and command information are below.</p>
            <div className="mt-5 flex flex-wrap gap-3"><Link href="/hub/resources" className="btn-primary">Open resources</Link><Link href="/hub/announcements" className="btn">Announcements</Link></div>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="order-2 grid min-w-0 content-start gap-5 lg:order-1 lg:col-span-7">
          <Panel title="Latest announcements" action={<Link href="/hub/announcements" className="text-[13px] link">View all</Link>} className={rest.length ? 'lg:min-h-[420px]' : ''}>
            {rest.length ? (
              <ul className="divide-y divide-line">
                {rest.map((n) => (
                  <li key={n.id}>
                    <Link href="/hub/announcements" className="flex min-h-14 items-center justify-between gap-4 py-3 hover:link">
                      <span className="min-w-0"><span className="block truncate text-[14px] font-medium">{n.title}</span>
                        <span className="text-[12px] text-faint">{n.priority !== 'normal' ? `${n.priority[0].toUpperCase()}${n.priority.slice(1)} · ` : ''}{n.author_name ?? 'Command'}</span></span>
                      <span className="shrink-0 text-[12px] text-faint">{n.published_at ? dateOnly(n.published_at) : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>No other announcements. <DiscordLink channel="announcements" className="mt-1 inline-block link" label="Check #announcements in Discord" /></Empty>}
          </Panel>
        </div>
        <div className="order-1 grid min-w-0 content-start gap-4 lg:order-2 lg:col-span-5">
          <Panel title="Mass Shift Center" action={<DiscordLink channel="mass-shifts" className="text-[13px] link" label="#mass-shifts" />}>
            <p className="text-[13px] text-muted">Mass shifts are announced in Discord. Rewards the department offers:</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">{MASS_SHIFT_REWARDS.map((r) => <li key={r} className="tag">{r}</li>)}</ul>
            <Link href="/hub/department/mass-shifts" className="mt-4 inline-block text-[13px] link">How mass shifts work →</Link>
          </Panel>
          <Panel title="Command information" action={<Link href="/team" className="text-[13px] link">Chain of command</Link>}>
            <ul className="grid gap-2">
              {office.map((l) => (
                <li key={l.callsign} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate"><span className="font-medium">{l.name ?? 'Vacant'}</span> <span className="text-muted">· {l.rank}</span></span>
                  <span className="tnum shrink-0 font-mono text-[12px] text-gold">{l.callsign}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4"><DiscordLink channel="command-info" className="text-[13px] link" label="Command notices in #command-info" /></div>
          </Panel>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="res-h">
        <h2 id="res-h" className="mb-4 text-[17px] font-semibold">Resources</h2>
        <ResourceGrid items={resources} />
      </section>
    </>
  );
}
