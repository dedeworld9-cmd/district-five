import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABEL } from '@/lib/format';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <span className="grid h-7 w-7 place-items-center rounded-full border border-gold/40 text-[11px] font-semibold text-gold">D5</span>
      <span className="text-[14px] font-medium tracking-tight">District Five</span>
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-4 pb-10 text-[12px] leading-relaxed text-faint sm:px-6">
      <div className="border-t border-line pt-6">
        District Five is a PlayStation 5 roleplay community. Every department, person and record here is fictional,
        and none of it is affiliated with any real government agency. Do not enter real-world personal information.
      </div>
    </footer>
  );
}

const TONE: Record<string, string> = {
  approved: 'tag-ok', active: 'tag-ok', on_duty: 'tag-ok',
  submitted: 'tag-gold', under_review: 'tag-gold', pending: 'tag-gold',
  returned: 'tag-warn', suspended: 'tag-warn',
  denied: 'tag-bad', removed: 'tag-bad',
};

export function StatusTag({ status }: { status: string }) {
  return <span className={`tag ${TONE[status] ?? ''}`}>{STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}</span>;
}

export function Flash({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ok = typeof searchParams.ok === 'string' ? searchParams.ok : null;
  const error = typeof searchParams.error === 'string' ? searchParams.error : null;
  if (!ok && !error) return null;
  return (
    <div role={error ? 'alert' : 'status'} data-flash={error ? 'error' : 'ok'}
      className={`mb-6 rounded-xl border px-4 py-3 text-[14px] ${error ? 'border-bad/30 text-bad' : 'border-ok/30 text-ok'}`}>
      {error ?? ok}
    </div>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="label mb-3 flex items-center gap-2"><span className="gold-dot" />{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line-strong px-5 py-10 text-center text-[14px] text-muted">{children}</div>;
}

export function Stat({ label, value, sub, gold, children }: { label: string; value: ReactNode; sub?: ReactNode; gold?: boolean; children?: ReactNode }) {
  return (
    <div className={`card p-5 ${gold ? 'border-gold/25' : ''}`}>
      <div className="label">{label}</div>
      <div className={`mt-3 text-[30px] font-semibold tracking-tight ${gold ? 'text-gold' : ''}`}>{value}</div>
      {sub && <div className="mt-1 text-[13px] text-muted">{sub}</div>}
      {children}
    </div>
  );
}
