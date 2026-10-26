'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      {items.map((i) => {
        const on = i.href === '/hub' ? path === '/hub' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors ${on ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>
            {i.label}
            {!!i.count && <span className="rounded-full bg-gold/15 px-1.5 text-[11px] font-semibold text-gold">{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
