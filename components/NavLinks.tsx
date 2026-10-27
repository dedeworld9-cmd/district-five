'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS: Record<string, string> = {
  '/hub': 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z',
  '/hub/join': 'M15 19v-1a4 4 0 0 0-8 0v1M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 8v6M22 11h-6',
  '/hub/shifts': 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  '/hub/reports': 'M9 12h6M9 16h6M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
  '/hub/board': 'M3 12h4l3-8 4 16 3-8h4',
  '/hub/approvals': 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  '/hub/roster': 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8',
  '/hub/announcements': 'M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1ZM16 9a4 4 0 0 1 0 6',
  '/hub/resources': 'M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h13',
  '/hub/admin': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
};

export function NavLinks({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      {items.map((i) => {
        const on = i.href === '/hub' ? path === '/hub' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors ${on ? 'bg-white/[0.09] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]' : 'text-muted hover:bg-white/[0.04] hover:text-ink'}`}>
            {ICONS[i.href] && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true" className={`hidden 2xl:block ${on ? 'text-[var(--accent,var(--color-gold))]' : 'opacity-70'}`}><path d={ICONS[i.href]} /></svg>
            )}
            {i.label}
            {!!i.count && <span className="rounded-full bg-gold/15 px-1.5 text-[11px] font-semibold text-gold">{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
