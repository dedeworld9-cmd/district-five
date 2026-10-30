'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Finds an unsent Activity Logger draft kept in this browser. Drafts live only in this browser's
// storage, so a different device or a cleared browser has nothing to recover.
export function DraftRecovery() {
  const [draft, setDraft] = useState<{ href: string; summary: string } | null>(null);
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith('d5:shift:')) continue;
        const v = JSON.parse(localStorage.getItem(k) ?? '{}');
        if (!(v.summary || v.start || v.end)) continue;
        const id = k.slice('d5:shift:'.length);
        setDraft({ href: id === 'new' ? '/hub/shifts/new' : `/hub/shifts/${id}`, summary: v.summary ? String(v.summary).slice(0, 80) : 'Times entered, no summary yet' });
        return;
      }
    } catch { /* storage unavailable */ }
  }, []);
  if (!draft) return null;
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-4 text-[13px]">
      <div className="font-medium text-gold">Unsent draft found in this browser</div>
      <p className="mt-1 truncate text-muted">{draft.summary}</p>
      <Link href={draft.href} className="btn btn-sm mt-3">Recover draft</Link>
    </div>
  );
}
