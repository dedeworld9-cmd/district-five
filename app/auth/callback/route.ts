import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DISCORD_GUILD, rankFromRoles } from '@/lib/discord';

// Reads the member's roles in the HCSO server and stores their highest rank as a hint. Any failure
// (scope declined, not in the server, Discord down) is ignored: sign-in must never depend on it.
async function reportRank(supabase: Awaited<ReturnType<typeof createClient>>, token: string) {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_GUILD}/member`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    const roles: string[] = res.ok ? ((await res.json()) as { roles?: string[] }).roles ?? [] : [];
    if (res.ok || res.status === 404) await supabase.rpc('report_discord_rank', { p_rank: rankFromRoles(roles) });
  } catch {
    /* hint only */
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/hub';
  const next = nextParam.startsWith('/hub') ? nextParam : '/hub';
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.session?.provider_token) await reportRank(supabase, data.session.provider_token);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Sign-in did not complete. Try again.')}`, url.origin));
}
