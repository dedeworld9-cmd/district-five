import { Flash, PageHead, StatusTag } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { TIER_LABEL } from '@/lib/tiers';
import { updateProfile } from '../actions';

export const metadata = { title: 'Profile' };

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const name = (k: string) => s.departments.find((d) => d.key === k)?.name ?? k;
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
