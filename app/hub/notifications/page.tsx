import { Empty, Flash, PageHead } from '@/components/ui';
import { relative } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Notification } from '@/lib/types';
import { markRead } from '../actions';

export const metadata = { title: 'Notifications' };

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireSession();
  const supabase = await createClient();
  const { data: items } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60).returns<Notification[]>();
  const unread = (items ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="max-w-2xl">
      <Flash searchParams={sp} />
      <PageHead eyebrow={`${unread} unread`} title="Notifications">
        {unread > 0 && <form action={markRead}><button className="btn btn-sm">Mark all read</button></form>}
      </PageHead>
      {items?.length ? (
        <ul className="card divide-y divide-line">
          {items.map((n) => (
            <li key={n.id}>
              <form action={markRead}>
                <input type="hidden" name="id" value={n.id} />
                {n.link && <input type="hidden" name="link" value={n.link} />}
                <button className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-white/[0.02]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-gold'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] ${n.read_at ? 'text-muted' : 'font-medium'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-[13px] text-muted">{n.body}</span>}
                  </span>
                  <span className="shrink-0 text-[12px] text-faint">{relative(n.created_at)}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : <Empty>You are all caught up.</Empty>}
    </div>
  );
}
