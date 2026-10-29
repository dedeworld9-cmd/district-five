'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type MenuItem = { href: string; label: string; count?: number; external?: boolean };

export const isCurrent = (path: string, href: string, exact = href === '/' || href === '/hub') =>
  exact ? path === href : path === href || path.startsWith(`${href}/`);

// Menu button and drop-down panel for narrow screens. Escape or a link closes it and focus
// goes back to the button; opening it moves focus to the first link.
export function MobileMenu({ items, footer, className = '' }: { items: MenuItem[]; footer?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className={className}>
      <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-white/[0.06]">
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div ref={panel} id={id} hidden={!open}
        className="absolute inset-x-3 top-full mt-2 rounded-2xl border border-line-strong bg-surface p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]">
        <nav aria-label="Menu">
          <ul className="grid gap-0.5">
            {items.map((i) => {
              const on = !i.external && isCurrent(path, i.href);
              const cls = `flex min-h-11 items-center justify-between rounded-xl px-4 text-[15px] ${on ? 'bg-white/[0.07] font-medium text-ink' : 'text-muted hover:bg-white/[0.04] hover:text-ink'}`;
              return (
                <li key={i.href}>
                  {i.external ? (
                    <a href={i.href} target="_blank" rel="noreferrer" className={cls}>{i.label}<span aria-hidden="true">↗</span></a>
                  ) : (
                    <Link href={i.href} aria-current={on ? 'page' : undefined} className={cls} onClick={() => setOpen(false)}>
                      {i.label}
                      {!!i.count && <span className="rounded-full bg-gold/15 px-2 text-[12px] font-semibold text-gold">{i.count}</span>}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        {footer && <div className="mt-2 border-t border-line p-2 pt-3">{footer}</div>}
      </div>
    </div>
  );
}
