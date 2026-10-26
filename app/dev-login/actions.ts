'use server';

import { redirect } from 'next/navigation';
import { devLoginEnabled, supabaseUrl } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export async function devSignIn(form: FormData) {
  if (!devLoginEnabled()) redirect('/login');
  const res = await fetch(`${supabaseUrl()}/dev/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: String(form.get('handle')) }),
  });
  const session = await res.json();
  const supabase = await createClient();
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  redirect('/hub');
}
