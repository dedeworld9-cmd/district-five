import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABEL } from '@/lib/format';
import { SITE } from '@/lib/site';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SITE.logo} alt="" width={30} height={30} className="h-[30px] w-[30px]" />
      <span className="text-[14px] font-semibold tracking-tight">{SITE.shortName}</span>
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-24 max-w-[1600px] px-4 pb-10 text-[12px] leading-relaxed text-faint sm:px-6 lg:px-10 min-[1440px]:px-16">
      <div className="border-t border-line pt-6">
        {SITE.shortName} is a roleplay department on {SITE.community.name} ({SITE.community.game}). Everyone and everything here is part of the game.
        It is not the real Hillsborough County Sheriff&apos;s Office or any government agency. Do not enter real-world personal information.
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
      className={`no-print rise mb-6 rounded-xl border px-4 py-3 text-[14px] ${error ? 'border-bad/30 bg-bad/[0.06] text-bad' : 'border-ok/30 bg-ok/[0.06] text-ok'}`}>
      {error ?? ok}
    </div>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="wordmark text-[30px] font-semibold tracking-tight sm:text-[38px]">{title}</h1>
        {eyebrow && <p className="mt-1.5 text-[14px] text-muted">{eyebrow}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white/[0.01] px-5 py-10 text-center text-[14px] text-muted">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-faint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z" /></svg>
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, gold, children }: { label: string; value: ReactNode; sub?: ReactNode; gold?: boolean; children?: ReactNode }) {
  return (
    <div className={`card card-hover relative overflow-hidden p-5 ${gold ? 'border-gold/25' : ''}`}>
      {gold && <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />}
      <div className="label">{label}</div>
      <div className={`mt-3 text-[30px] font-semibold tracking-tight ${gold ? 'text-gold' : ''}`}>{value}</div>
      {sub && <div className="mt-1 text-[13px] text-muted">{sub}</div>}
      {children}
    </div>
  );
}
