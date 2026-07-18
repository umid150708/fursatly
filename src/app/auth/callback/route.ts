import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/supabase/server';

/**
 * GET /auth/callback?code=...&next=/account
 *
 * PKCE landing for OAuth (Google) and email links (magic link, sign-up
 * confirmation). Exchanges the one-time code for a session cookie, then
 * bounces to `next` (same-origin paths only).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/account';
  // Only allow same-origin relative paths — never redirect off-site.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth?error=callback`);
}
