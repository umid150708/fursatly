/**
 * GET /api/telegram/connect-link — mint a personal Telegram deep link.
 *
 * Signed-in only. Returns `https://t.me/<bot>?start=<signed-token>`; tapping
 * "Start" in Telegram delivers the token to /api/telegram/webhook, which links
 * the chat to this account. The token is stateless (HMAC, 15-min TTL) so there
 * is nothing to store or clean up.
 */
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/supabase/server';
import { signConnectToken } from '@/lib/connect-token';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!bot || !secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const token = signConnectToken(user.id, secret);
  return NextResponse.json({ url: `https://t.me/${bot}?start=${token}` });
}
