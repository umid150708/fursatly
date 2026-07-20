import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie on every matched request and gates
 * /account server-side (no flash of unauthenticated content).
 */
export async function middleware(request: NextRequest) {
  // ── Canonical host ─────────────────────────────────────────────────────────
  // fursatly.uz (apex) and www.fursatly.uz both serve the app, but Supabase
  // sets the auth cookie host-only. Signing in on one host left the other
  // logged out (OAuth lands on the www Site URL, then apex visitors saw no
  // session). Funnel everyone to the apex so there is a single cookie jar —
  // query + path preserved so the OAuth `?code=` survives the hop.
  const host = request.headers.get('host');
  if (host === 'www.fursatly.uz') {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://fursatly.uz');
    return NextResponse.redirect(url, 308);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession()) — validates the JWT against
  // Supabase and refreshes expired tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/account')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets — API routes included, they may read the session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
