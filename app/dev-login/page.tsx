import { notFound } from 'next/navigation';
import { Brand } from '@/components/ui';
import { devLoginEnabled } from '@/lib/supabase/env';
import { devSignIn } from './actions';

export const dynamic = 'force-dynamic';

const PERSONAS = [
  ['admin', 'Technical administrator (no roster access by default)'],
  ['hcso_member', 'HCSO deputy'],
  ['hcso_supervisor', 'HCSO sergeant'],
  ['hcso_head', 'HCSO sheriff (department head)'],
  ['sahp_member', 'SAHP trooper'],
  ['dps_command', 'DPS command'],
  ['safd_member', 'SAFD firefighter'],
  ['safd_supervisor', 'SAFD lieutenant'],
  ['saems_member', 'SAEMS EMT'],
  ['fems_command', 'Fire/EMS Administration command'],
  ['new_member', 'Signed in, not on any roster'],
];

export default function DevLogin() {
  if (!devLoginEnabled()) notFound();
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Brand />
      <h1 className="mt-12 text-[26px] font-semibold tracking-tight">Local test personas</h1>
      <p className="mt-2 text-[14px] text-muted">Only available against a local development backend. Run <code>npm run dev:db</code> and <code>npm run dev:backend</code> first.</p>
      <div className="mt-8 grid gap-2">
        {PERSONAS.map(([handle, label]) => (
          <form key={handle} action={devSignIn}>
            <input type="hidden" name="handle" value={handle} />
            <button className="card flex w-full items-center justify-between px-4 py-3 text-left hover:border-line-strong">
              <span className="text-[14px]">{label}</span>
              <span className="font-mono text-[12px] text-faint">{handle}</span>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
