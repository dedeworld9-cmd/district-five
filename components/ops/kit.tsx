import Link from 'next/link';
import type { ReactNode } from 'react';
import { Empty } from '@/components/ui';
import { channelLink } from '@/lib/workspaces';
import type { ChannelKey } from '@/lib/discord';
import { GATE_LABEL, type Gate } from '@/lib/workspaces';

// Shared pieces of the Operations Center. Server components; no client state.

export function WorkspaceHeader({ title, description, children, restricted }: { title: string; description?: string; children?: ReactNode; restricted?: string }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mb-6 md:min-h-[68px]">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] leading-tight font-semibold tracking-tight md:text-[26px]">
          {title}
          {restricted && <span className="tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{restricted}</span>}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] text-muted md:text-[14px]">{description}</p>}
      </div>
      {children && <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, href }: { label: string; value: ReactNode; sub?: ReactNode; href?: string }) {
  const inner = (
    <>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="tnum mt-1 text-[26px] leading-none font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 truncate text-[12px] text-faint">{sub}</div>}
    </>
  );
  const cls = 'card block min-w-0 px-4 py-4 md:min-h-[96px]';
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export function Icon({ d }: { d: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-strong">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    </span>
  );
}
export const ICONS = {
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  shield: 'M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  cap: 'm3 9 9-5 9 5-9 5zM7 12v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  key: 'M14 10a4 4 0 1 1-1.2-2.8L21 15v3h-3v-2h-2v-2h-2z',
  mega: 'M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1zM19 9a4 4 0 0 1 0 6',
  pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
} as const;

// A link to a verified Discord channel. Opens in a new tab; works only for members who can see it.
export function DiscordLink({ channel, label, className = 'btn' }: { channel: ChannelKey; label?: string; className?: string }) {
  const c = channelLink(channel);
  return (
    <a href={c.url} target="_blank" rel="noopener noreferrer" className={className}>
      {label ?? `Open ${c.name}`}{'\u00A0'}<svg className="inline-block shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
      <span className="sr-only"> in Discord, opens in a new tab</span>
    </a>
  );
}

export type ResourceItem = { title: string; desc: string; icon?: keyof typeof ICONS; href?: string; channel?: ChannelKey; tag?: string };

// A card that links to a native page, an external document or a Discord channel.
export function ResourceCard({ item }: { item: ResourceItem }) {
  const url = item.channel ? channelLink(item.channel).url : item.href;
  const external = !!url && /^https?:/.test(url);
  const body = (
    <>
      <div className="flex items-start gap-3">
        <Icon d={ICONS[item.icon ?? 'doc']} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{item.title}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{item.desc}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-[12px]">
        <span className="text-faint">{item.tag ?? (item.channel ? 'Discord' : external ? 'Document' : 'In the hub')}</span>
        <span className="link">{url ? (external ? 'Open ↗' : 'Open →') : 'Unavailable'}</span>
      </div>
    </>
  );
  const cls = 'card card-hover flex min-w-0 flex-col justify-between p-5';
  if (!url) return <div className={`${cls} opacity-70`}>{body}</div>;
  return external
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>{body}<span className="sr-only">Opens in a new tab</span></a>
    : <Link href={url} className={cls}>{body}</Link>;
}

export function ResourceGrid({ items, cols = 3 }: { items: ResourceItem[]; cols?: 2 | 3 | 4 }) {
  const c = cols === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : cols === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2';
  return <div className={`grid gap-3 md:gap-5 ${c}`}>{items.map((i) => <ResourceCard key={i.title} item={i} />)}</div>;
}

// Wide table on desktop, stacked record cards below 768px. The first cell is the card title.
export function DataTable({ columns, rows, empty }: { columns: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: ReactNode }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
          <thead>
            <tr className="h-11 border-b border-line text-[12px] text-muted">
              {columns.map((c) => <th key={c} scope="col" className="px-3 font-medium first:pl-0 last:pr-0">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="h-14 border-b border-line last:border-0 hover:bg-white/[0.025] focus-within:bg-white/[0.025]">
                {r.cells.map((c, i) => <td key={i} className="px-3 first:pl-0 last:pr-0">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="text-[15px] font-medium">{r.cells[0]}</div>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
              {r.cells.slice(1).map((c, i) => (
                <div key={i} className="contents"><dt className="text-faint">{columns[i + 1]}</dt><dd className="min-w-0 text-right">{c}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AccessDenied({ gate }: { gate: Gate }) {
  return (
    <div role="alert" className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="text-[20px] font-semibold">Restricted</h1>
      <p className="mt-2 text-[14px] text-muted">This area is for {GATE_LABEL[gate].toLowerCase()}. If you think you should have access, ask command to check your rank on the roster.</p>
      <Link href="/hub" className="btn mt-5">Back to overview</Link>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

// Settings-style grouped list: one solid rounded container, hairline rows, a chevron on the right.
export type ListRow = { label: string; sub?: string; href?: string; channel?: ChannelKey; right?: ReactNode };
export function ListGroup({ rows, label }: { rows: ListRow[]; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-bg-2">
      {rows.map((r) => {
        const url = r.channel ? channelLink(r.channel).url : r.href;
        const external = !!url && /^https?:/.test(url);
        const inner = (
          <>
            <span className="min-w-0"><span className="block truncate text-[14px]">{r.label}</span>{r.sub && <span className="block truncate text-[12px] text-faint">{r.sub}</span>}</span>
            <span className="flex shrink-0 items-center gap-2 text-faint">{r.right}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{external ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="m9 6 6 6-6 6" />}</svg></span>
          </>
        );
        const cls = 'flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-white/[0.04]';
        return (
          <li key={r.label}>
            {!url ? <div className={cls}>{inner}</div>
              : external ? <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}<span className="sr-only">Opens in a new tab</span></a>
              : <Link href={url} className={cls}>{inner}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
