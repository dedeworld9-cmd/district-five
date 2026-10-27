import { Flash, PageHead, StatusTag } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { TIER_LABEL } from '@/lib/tiers';
import type { MemberCertification } from '@/lib/types';
import { updateProfile } from '../actions';

export const metadata = { title: 'Profile' };

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const name = (k: string) => s.departments.find((d) => d.key === k)?.name ?? k;
  const supabase = await createClient();
  const { data: certs } = s.active.length
    ? await supabase.from('member_certifications').select('*').in('membership_id', s.active.map((m) => m.id)).is('revoked_at', null)
      .order('name').returns<MemberCertification[]>()
    : { data: [] as MemberCertification[] };
  return (
    <div className="max-w-2xl">
      <Flash searchParams={sp} />
      <PageHead eyebrow={s.profile.discord_username ? `Discord · ${s.profile.discord_username}` : 'Account'} title={s.profile.display_name} />
      <section className="mb-8 grid gap-2">
        {s.mine.filter((m) => m.status !== 'denied').map((m) => (
          <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="text-[15px] font-medium">{name(m.department_key)}</div>
              <div className="text-[13px] text-muted">{[m.rank_name, m.callsign, m.badge && `#${m.badge}`, TIER_LABEL[m.tier]].filter(Boolean).join(' · ')}</div>
            </div>
            <StatusTag status={m.status} />
            {m.status === 'active' && ((certs ?? []).some((c) => c.membership_id === m.id) || m.subdivisions?.length > 0) && (
              <div className="flex w-full flex-wrap gap-1.5 border-t border-line pt-3">
                {(certs ?? []).filter((c) => c.membership_id === m.id).map((c) => <span key={c.id} className="tag tag-gold">{c.name}</span>)}
                {(m.subdivisions ?? []).map((x) => <span key={x} className="tag">{x}</span>)}
              </div>
            )}
          </div>
        ))}
      </section>
      <form action={updateProfile} className="card grid gap-4 p-6">
        <label className="field"><span>Display name (your roleplay name)</span>
          <input name="display_name" className="input" defaultValue={s.profile.display_name} required minLength={2} maxLength={60} />
        </label>
        <label className="field"><span>PSN ID (optional)</span>
          <input name="psn_id" className="input" defaultValue={s.profile.psn_id ?? ''} maxLength={32} />
        </label>
        <p className="text-[12px] text-faint">The hub stores only your Discord ID, display name and PSN ID. Do not add real-world personal details.</p>
        <div><button className="btn-primary">Save</button></div>
      </form>
      <form action="/auth/signout" method="post" className="mt-8">
        <button className="btn">Sign out</button>
      </form>
    </div>
  );
}
