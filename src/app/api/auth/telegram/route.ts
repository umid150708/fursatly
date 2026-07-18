/**
 * POST /api/auth/telegram
 *
 * Two modes, both HMAC-verified against TELEGRAM_BOT_TOKEN
 * (https://core.telegram.org/widgets/login#checking-authorization):
 *
 *  mode "login"   — signs a student in with Telegram alone. Creates (or finds)
 *                   the Supabase user anchored at tg-<id>@telegram.fursatly.uz,
 *                   then returns a one-time token_hash the client exchanges for
 *                   a real cookie session via verifyOtp.
 *  mode "connect" — links Telegram to the CURRENTLY signed-in account (for
 *                   reminders). Requires Authorization: Bearer <access_token>;
 *                   only updates the caller's own profile.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyTelegramAuth,
  telegramEmail,
  type TelegramAuthPayload,
} from '@/lib/telegram-auth';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const displayName = (p: TelegramAuthPayload) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || `tg-${p.id}`;

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'telegram_not_configured' }, { status: 500 });
  }

  let body: { mode?: 'login' | 'connect'; payload?: TelegramAuthPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const { mode, payload } = body;
  if ((mode !== 'login' && mode !== 'connect') || !payload) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // ── Verify Telegram's signature before trusting ANY field ──────────────
  const verdict = verifyTelegramAuth(payload, botToken);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 401 });
  }

  const supabase = admin();

  // ── mode: connect — link Telegram to the signed-in account ─────────────
  if (mode === 'connect') {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: payload.id,
        telegram_username: payload.username ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.user.id);

    if (updErr) {
      // 23505 = unique_violation → this Telegram is linked to another account
      const conflict = updErr.code === '23505';
      return NextResponse.json(
        { error: conflict ? 'telegram_already_linked' : 'update_failed' },
        { status: conflict ? 409 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── mode: login — find/create the Telegram-anchored user, mint session ─
  const email = telegramEmail(payload.id);
  const meta = {
    full_name: displayName(payload),
    avatar_url: payload.photo_url ?? null,
    telegram_chat_id: String(payload.id),
    telegram_username: payload.username ?? '',
  };

  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: meta,
  });
  // "already registered" is fine — anything else is fatal.
  if (createErr && !/already|exists/i.test(createErr.message)) {
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // Keep the profile's Telegram linkage fresh on every login (also covers
  // users created before this field existed).
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'link_failed' }, { status: 500 });
  }

  const userId = linkData.user?.id;
  if (userId) {
    await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          display_name: displayName(payload),
          avatar_url: payload.photo_url ?? null,
          telegram_chat_id: payload.id,
          telegram_username: payload.username ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
  }

  return NextResponse.json({ token_hash: linkData.properties.hashed_token });
}
