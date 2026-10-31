import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseKey, supabaseUrl } from './lib/supabase/env';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname.startsWith('/hub')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // An unreachable backend is not the same as being signed out; say so instead of asking for a sign-in.
    const down = error?.name === 'AuthRetryableFetchError' || error?.status === 0 || (error?.status ?? 0) >= 500;
    url.search = down
      ? `?error=${encodeURIComponent('The member hub cannot reach its database right now. Try again in a minute.')}`
      : `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};
