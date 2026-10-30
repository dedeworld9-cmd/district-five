'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NavWorkspace } from '@/lib/workspaces';

type Item = { label: string; hint: string; href: string };

// Command palette: jump to any page the member may open, or start a common action.
// The list comes from the same permission-filtered navigation as the sidebar; opening a page
// still runs that page's own server-side check.
export function Palette({ nav, open, onClose, quick }: { nav: NavWorkspace[]; open: boolean; onClose: () => void; quick: Item[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const all = useMemo<Item[]>(() => [
    ...quick,
    { label: 'Overview', hint: 'Go to', href: '/hub' },
    ...nav.flatMap((w) => w.pages.map((p) => ({ label: p.label === 'Overview' ? w.label : p.label, hint: p.label === 'Overview' ? 'Workspace' : w.label, href: p.href }))),
    { label: 'Profile', hint: 'Account', href: '/hub/profile' },
    { label: 'Notifications', hint: 'Account', href: '/hub/notifications' },
  ], [nav, quick]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all.slice(0, 9);
    return all.filter((x) => `${x.label} ${x.hint}`.toLowerCase().includes(t)).slice(0, 9);
  }, [all, q]);

  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  useEffect(() => setI(0), [q]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;
  const go = (x?: Item) => { if (!x) return; onClose(); router.push(x.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[i]); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKey}>
      <button type="button" aria-label="Close search" tabIndex={-1} className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className="glass pop relative w-full max-w-[560px] overflow-hidden rounded-2xl border shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-faint" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[i] ? `pal-${i}` : undefined}
            placeholder="Search pages and actions" className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
          <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-faint">esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length ? results.map((x, n) => (
            <li key={x.href + x.label} id={`pal-${n}`} role="option" aria-selected={n === i}>
              <button type="button" onMouseMove={() => setI(n)} onClick={() => go(x)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[14px] ${n === i ? 'bg-white/[0.08]' : ''}`}>
                <span className="truncate">{x.label}</span><span className="shrink-0 text-[12px] text-faint">{x.hint}</span>
              </button>
            </li>
          )) : <li className="px-3 py-6 text-center text-[13px] text-muted">Nothing matches “{q}”.</li>}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.08] px-4 py-2.5 text-[11px] text-faint">
          <span>↑↓ move</span><span>↵ open</span><span>g then d / p / l / t / h to jump</span><span>[ toggles sidebar</span>
        </div>
      </div>
    </div>
  );
}
