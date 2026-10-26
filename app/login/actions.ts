'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signInWithDiscord(form: FormData) {
  const next = String(form.get('next') ?? '/hub');
  const h = await headers();
  const origin = h.get('origin') ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next.startsWith('/hub') ? next : '/hub')}`,
      scopes: 'identify',
    },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent('Discord sign-in is not available right now.')}`);
  redirect(data.url);
}
