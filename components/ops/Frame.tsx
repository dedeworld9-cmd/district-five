'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ROUTE_ALIAS, type NavWorkspace } from '@/lib/workspaces';

const ICON: Record<string, ReactNode> = {
  overview: <path d="M3 11 12 3l9 8M5 10v10h14V10" />,
  department: <path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6M4 20h16" />,
  patrol: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  logging: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  training: <path d="m3 9 9-5 9 5-9 5-9-5ZM7 12v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" />,
  'high-ranking': <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
};
const Icon = ({ k }: { k: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">{ICON[k]}</svg>
);

const match = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

// Which workspace and page the current URL belongs to (longest matching link wins).
export function locate(path: string, nav: NavWorkspace[]) {
  let best: { ws: NavWorkspace; label: string; len: number } | null = null;
  const offer = (ws: NavWorkspace | undefined, label: string, href: string) => {
    if (ws && match(path, href) && (!best || href.length > best.len)) best = { ws, label, len: href.length };
  };
  for (const ws of nav) for (const p of ws.pages) offer(ws, p.label, p.href);
  for (const a of ROUTE_ALIAS) offer(nav.find((w) => w.slug === a.ws), a.label, a.prefix);
  return best as { ws: NavWorkspace; label: string } | null;
}

function Tree({ nav, path, collapsed, onNavigate }: { nav: NavWorkspace[]; path: string; collapsed: boolean; onNavigate?: () => void }) {
  const here = locate(path, nav);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const row = 'flex min-h-[42px] items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors';
  const on = 'bg-brand-soft font-medium text-ink shadow-[inset_2px_0_0_var(--color-gold)]';
  const off = 'text-muted hover:bg-white/[0.04] hover:text-ink';
  return (
    <nav aria-label="Workspaces" className="grid gap-1 px-3 py-3">
      <Link href="/hub" onClick={onNavigate} title="Overview" aria-current={path === '/hub' ? 'page' : undefined} className={`${row} ${path === '/hub' ? on : off} ${collapsed ? 'justify-center px-0' : ''}`}>
        <Icon k="overview" />{!collapsed && 'Overview'}
      </Link>
      {nav.map((w) => {
        const current = here?.ws.slug === w.slug;
        const expanded = !collapsed && (open[w.slug] ?? current);
        return (
          <div key={w.slug} className="mt-1">
            <div className="flex items-center">
              <Link href={w.href} onClick={onNavigate} title={w.label} aria-current={path === w.href ? 'page' : undefined}
                className={`${row} min-w-0 flex-1 ${current ? 'text-ink' : off} ${path === w.href ? on : ''} ${collapsed ? 'justify-center px-0' : ''}`}>
                <Icon k={w.slug} /><span className={collapsed ? 'sr-only' : 'truncate'}>{w.label}</span>
              </Link>
              {!collapsed && (
                <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${w.label}`}
                  onClick={() => setOpen({ ...open, [w.slug]: !expanded })} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:text-ink">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              )}
            </div>
            {expanded && (
              <ul className="mt-0.5 mb-1 ml-[22px] grid gap-0.5 border-l border-line pl-2">
                {w.pages.filter((p) => p.href !== w.href).map((p) => {
                  const active = here?.ws.slug === w.slug && here.label === p.label;
                  return (
                    <li key={p.href}>
                      <Link href={p.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                        className={`flex min-h-9 items-center rounded-lg px-3 text-[13px] ${active ? 'bg-brand-soft font-medium text-ink' : 'text-muted hover:bg-white/[0.04] hover:text-ink'}`}>
                        <span className="truncate">{p.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <Link href="/hub/profile" onClick={onNavigate} title="Profile" aria-current={path.startsWith('/hub/profile') ? 'page' : undefined}
        className={`${row} mt-2 ${path.startsWith('/hub/profile') ? on : off} ${collapsed ? 'justify-center px-0' : ''}`}>
        <Icon k="profile" />{!collapsed && 'Profile'}
      </Link>
    </nav>
  );
}

export function Breadcrumbs({ nav }: { nav: NavWorkspace[] }) {
  const path = usePathname();
  const here = locate(path, nav);
  const crumbs: { label: string; href?: string }[] = [{ label: 'HCSO', href: '/hub' }];
  if (here) {
    crumbs.push({ label: here.ws.label, href: here.ws.href });
    if (here.label !== 'Overview') crumbs.push({ label: here.label });
  } else if (path.startsWith('/hub/profile')) crumbs.push({ label: 'Profile' });
  else if (path.startsWith('/hub/notifications')) crumbs.push({ label: 'Notifications' });
  else if (path.startsWith('/hub/join')) crumbs.push({ label: 'Join HCSO' });
  else crumbs.push({ label: 'Overview' });
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.label} className={`flex min-w-0 items-center gap-1.5 ${i > 0 && i < crumbs.length - 1 ? 'hidden sm:flex' : ''}`}>
              {i > 0 && <span aria-hidden="true" className="text-faint">/</span>}
              {last || !c.href ? <span aria-current="page" className="truncate font-medium text-ink">{c.label}</span> : <Link href={c.href} className="truncate hover:text-ink">{c.label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Section tabs for the workspace the current page belongs to. Scrolls inside its own strip.
export function SectionNav({ nav }: { nav: NavWorkspace[] }) {
  const path = usePathname();
  const here = locate(path, nav);
  if (!here) return null;
  const items = here.ws.pages;
  return (
    <nav aria-label={`${here.ws.label} sections`} className="no-print -mx-1 mb-6 overflow-x-auto px-1 [scrollbar-width:none]">
      <ul className="flex w-max min-w-full gap-1 border-b border-line">
        {items.map((p) => {
          const active = here.label === p.label || (here.label === 'Overview' && p.label === 'Overview');
          return (
            <li key={p.href}>
              <Link href={p.href} aria-current={active ? 'page' : undefined}
                className={`-mb-px flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-[13px] ${active ? 'border-gold font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Frame({ nav, brand, headerRight, children }: { nav: NavWorkspace[]; brand: ReactNode; headerRight: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('hcso:sidebar') === 'collapsed'); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!drawer) return;
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [drawer]);

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('hcso:sidebar', c ? 'expanded' : 'collapsed'); } catch { /* ignore */ }
      return !c;
    });
  };

  return (
    <div className="ops min-h-screen" data-collapsed={collapsed}>
      <aside aria-label="Sidebar" className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex"
        style={{ width: collapsed ? 72 : 252 }}>
        <div className={`flex h-[72px] shrink-0 items-center border-b border-line ${collapsed ? 'justify-center' : 'px-5'}`}>{collapsed ? <span className="[&_span]:sr-only">{brand}</span> : brand}</div>
        <div className="min-h-0 flex-1 overflow-y-auto"><Tree nav={nav} path={path} collapsed={collapsed} /></div>
        <button type="button" onClick={toggle} aria-pressed={collapsed} className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-line text-[12px] text-faint hover:text-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={collapsed ? 'rotate-180' : ''} aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          {collapsed ? <span className="sr-only">Expand sidebar</span> : 'Collapse sidebar'}
        </button>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} tabIndex={-1} />
          <div role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col border-r border-line bg-surface">
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-4">
              {brand}
              <button ref={closeBtn} type="button" onClick={() => setDrawer(false)} className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:text-ink">
                <span className="sr-only">Close menu</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto"><Tree nav={nav} path={path} collapsed={false} onNavigate={() => setDrawer(false)} /></div>
          </div>
        </div>
      )}

      <div className="min-w-0 transition-[padding] duration-200 lg:pl-[var(--side)]" style={{ '--side': collapsed ? '72px' : '252px' } as React.CSSProperties}>
        <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:px-5 md:h-[68px] lg:px-6 min-[1440px]:px-8">
          <button type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-white/[0.06] lg:hidden">
            <span className="sr-only">Open menu</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="min-w-0 flex-1"><Breadcrumbs nav={nav} /></div>
          {headerRight}
        </header>
        <main id="main" className="mx-auto w-full max-w-[1504px] px-4 pt-6 pb-12 sm:px-5 md:pt-7 md:pb-12 lg:px-6 min-[1440px]:px-8">
          <SectionNav nav={nav} />
          {children}
        </main>
      </div>
    </div>
  );
}
