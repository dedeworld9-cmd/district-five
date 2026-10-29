import { Empty, Flash, PageHead } from '@/components/ui';
import { relative } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIERS, TIER_LABEL, atLeast } from '@/lib/tiers';
import type { Announcement } from '@/lib/types';
import { saveAnnouncement, setAnnouncementPublic } from '../actions';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Announcements' };

export default async function Announcements({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  const { data: items } = await supabase.from('announcements').select('*').eq('department_key', SITE.department).neq('status', 'archived')
    .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50).returns<Announcement[]>();
  const postable = s.departments.filter((d) => d.kind === 'department' && (s.oversees(d.key) || atLeast(s.tierIn(d.key), 'high_command')));
  const canPost = s.isDps || postable.length > 0;
  const canApprovePublic = (a: Announcement) => (a.scope === 'district' && s.isDps) || (a.scope === 'department' && s.oversees(a.department_key ?? '')) || (a.scope === 'department' && atLeast(s.tierIn(a.department_key ?? ''), 'department_head'));
  const short = (k: string | null) => (k ? s.departments.find((d) => d.key === k)?.short_name ?? k : 'District');

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead title="Announcements" />
      <div className={`grid gap-10 [&>*]:min-w-0 ${canPost ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
        <div className="grid content-start gap-3">
          {items?.length ? items.map((a) => (
            <article key={a.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-faint">
                <span>{a.scope === 'district' ? 'District' : short(a.department_key)}</span>
                <span>·</span><span>{a.author_name}</span><span>·</span><span>{relative(a.published_at ?? a.created_at)}</span>
                {a.pinned && <span className="tag">Pinned</span>}
                {a.priority !== 'normal' && <span className="tag tag-gold">{a.priority}</span>}
                {a.status === 'draft' && <span className="tag tag-warn">Draft</span>}
                {a.is_public && <span className="tag tag-ok">On public site</span>}
                {a.audience_min_tier !== 'probationary' && <span className="tag">{TIER_LABEL[a.audience_min_tier]}+</span>}
              </div>
              <h2 className="mt-2 text-[17px] font-medium">{a.title}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap text-muted">{a.body}</p>
              {(a.status === 'draft' && canPost) || (a.status === 'published' && canApprovePublic(a)) ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  {a.status === 'draft' && (
                    <form action={saveAnnouncement.bind(null, 'publish')}>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="title" value={a.title} />
                      <input type="hidden" name="body" value={a.body} /><input type="hidden" name="scope" value={a.scope} />
                      <input type="hidden" name="department" value={a.department_key ?? ''} />
                      {a.pinned && <input type="hidden" name="pinned" value="on" />}
                      <button className="btn-primary btn-sm">Publish</button>
                    </form>
                  )}
                  {a.status === 'published' && canApprovePublic(a) && (
                    <form action={setAnnouncementPublic}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="public" value={a.is_public ? '0' : '1'} />
                      <button className="btn btn-sm">{a.is_public ? 'Remove from public site' : 'Approve for public site'}</button>
                    </form>
                  )}
                </div>
              ) : null}
            </article>
          )) : <Empty>No announcements yet.</Empty>}
        </div>

        {canPost && (
          <form className="card grid grid-cols-[minmax(0,1fr)] content-start gap-4 p-6">
            <h2 className="label">New announcement</h2>
            <label className="field"><span>Post to</span>
              <select name="scope_dept" className="input" defaultValue={postable[0] ? `department:${postable[0].key}` : 'district:'}>
                {s.isDps && <option value="district:">All departments</option>}
                {postable.map((d) => <option key={d.key} value={`department:${d.key}`}>{d.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Title</span><input name="title" className="input" required minLength={3} maxLength={160} /></label>
            <label className="field"><span>Message</span><textarea name="body" className="input" rows={6} /></label>
            <div className="grid gap-3 min-[360px]:grid-cols-2 [&>*]:min-w-0">
              <label className="field"><span>Priority</span>
                <select name="priority" className="input"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select>
              </label>
              <label className="field"><span>Visible to</span>
                <select name="audience" className="input">
                  {TIERS.filter((t) => t !== 'dps').map((t) => <option key={t} value={t}>{TIER_LABEL[t]} and up</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-[14px] text-muted"><input type="checkbox" name="pinned" /> Pin to the top</label>
            <div className="flex flex-wrap gap-2">
              <button formAction={saveAnnouncement.bind(null, 'publish')} className="btn-primary">Publish to members</button>
              <button formAction={saveAnnouncement.bind(null, 'draft')} className="btn">Save draft</button>
            </div>
            <p className="text-[12px] text-faint">Publishing shares it inside the hub only. A department head or division command approves anything for the public site separately.</p>
          </form>
        )}
      </div>
    </>
  );
}
