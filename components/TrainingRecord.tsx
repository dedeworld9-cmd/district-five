import { revokeCertification } from '@/app/hub/actions';
import { dateOnly } from '@/lib/format';
import type { MemberCertification } from '@/lib/types';

// Certifications held and subdivisions joined. Command can revoke a certification with a reason.
export function TrainingRecord({ certs, subdivisions, canRevoke, back }: {
  certs: MemberCertification[]; subdivisions: string[]; canRevoke: boolean; back: string;
}) {
  const held = certs.filter((c) => !c.revoked_at);
  return (
    <section className="card mt-6 p-6">
      <h2 className="label mb-4">Training record</h2>
      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <div>
          <div className="mb-2 text-[13px] text-muted">Certifications</div>
          {held.length ? (
            <ul className="grid gap-2">
              {held.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
                  <span className="tag tag-gold">{c.name}</span>
                  <span className="text-[12px] text-faint">{dateOnly(c.granted_at)}{c.granted_by_name ? ` · ${c.granted_by_name}` : ''}</span>
                  {canRevoke && (
                    <details className="ml-auto">
                      <summary className="cursor-pointer text-[12px] text-muted hover:text-bad">Revoke</summary>
                      <form action={revokeCertification} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="back" value={back} />
                        <input name="reason" className="input h-8 text-[13px]" required minLength={3} maxLength={600} placeholder="Reason" />
                        <button className="btn-danger btn-sm">Revoke</button>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-faint">None yet.</p>}
        </div>
        <div>
          <div className="mb-2 text-[13px] text-muted">Subdivisions</div>
          {subdivisions.length
            ? <div className="flex flex-wrap gap-1.5">{subdivisions.map((x) => <span key={x} className="tag">{x}</span>)}</div>
            : <p className="text-[14px] text-faint">None.</p>}
        </div>
      </div>
    </section>
  );
}
