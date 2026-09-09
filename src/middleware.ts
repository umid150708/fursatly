import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Canonical host, plus the Supabase session gate for /account.
 *
 * The session work is deliberately NOT done on every request. `getUser()`
 * validates the JWT against Supabase over the network — measured at 0.6–1.4s —
 * and it blocks the response, so every millisecond of it lands directly on
 * TTFB. Doing that on the homepage bought nothing: neither `/` nor `/event/*`
 * reads the session server-side (both are ISR pages fetched with the anon key),
 * and every route handler that DOES need a session calls `getUser()` itself.
 * So it runs only where the answer is used, and only when a session cookie is
 * actually present.
 */

/** Paths whose server code branches on the session. Everything else renders
 *  identically signed in or out. */
const SESSION_PATHS = ['/account'];

/** @supabase/ssr stores the session in `sb-<project-ref>-auth-token`, split
 *  across `.0`/`.1` chunks when it is large. No such cookie ⇒ signed out, and
 *  there is nothing for Supabase to validate or refresh. */
const hasSessionCookie = (request: NextRequest) =>
  request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

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

  const { pathname } = request.nextUrl;
  const needsSession = SESSION_PATHS.some((p) => pathname.startsWith(p));

  // Nothing here depends on who is asking — hand the request straight on.
  if (!needsSession) return NextResponse.next();

  // Gated path, but no cookie to validate: signed out, no round-trip needed.
  if (!hasSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
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

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets. The handler above exits early for paths
  // that don't need a session, which is cheaper than matching them here — the
  // canonical-host redirect still has to see every request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
