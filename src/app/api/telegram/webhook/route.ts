import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ingestEventFromText } from '@/services/event-ingestion';
import { verifyConnectToken } from '@/lib/connect-token';

// Vercel: short-running, but still cap it
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/telegram/webhook
 *
 * Authenticated via Telegram's `X-Telegram-Bot-Api-Secret-Token` header.
 * The secret is the value you pass when calling `setWebhook` on the Bot API:
 *
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *        -d "url=https://fursatly.uz/api/telegram/webhook" \
 *        -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 *
 * Without this guard the endpoint is a free DoS surface — anyone could
 * POST arbitrary text and burn Groq quota.
 *
 * Two jobs:
 *  1. `/start <connect-token>` in a PRIVATE chat → link this Telegram chat to
 *     the Fursatly account encoded in the token (see /api/telegram/connect-link)
 *     and confirm with a localized DM.
 *  2. Anything else → the original event-ingestion path, unchanged.
 */

/** Localized one-liners for the connect flow, keyed by Telegram language_code. */
const CONNECT_COPY = {
  ok: {
    en: '✅ Connected! Deadline reminders for your saved opportunities will arrive here.',
    uz: "✅ Ulandi! Saqlangan imkoniyatlaringiz uchun muddat eslatmalari shu yerga keladi.",
    ru: '✅ Подключено! Напоминания о дедлайнах сохранённых возможностей будут приходить сюда.',
  },
  expired: {
    en: '⌛ This link has expired. Open your Fursatly account and tap "Connect Telegram" again.',
    uz: "⌛ Havola muddati tugagan. Fursatly hisobingizni ochib, yana \"Telegramni ulash\" tugmasini bosing.",
    ru: '⌛ Ссылка устарела. Откройте свой аккаунт Fursatly и снова нажмите «Подключить Telegram».',
  },
} as const;

const pickLang = (code?: string): 'en' | 'uz' | 'ru' =>
  code?.startsWith('uz') ? 'uz' : code?.startsWith('ru') ? 'ru' : 'en';

async function sendDm(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // linking still succeeded; only the confirmation is lost
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.warn('[Telegram Webhook] confirmation DM failed:', err instanceof Error ? err.message : err);
  }
}

/** Handle `/start <token>` from a private chat. Returns a response when handled. */
async function handleConnectStart(message: any): Promise<NextResponse | null> {
  if (message?.chat?.type !== 'private') return null;
  const m = /^\/start(?:\s+(\S+))?$/.exec(message.text.trim());
  if (!m) return null;

  const lang = pickLang(message.from?.language_code);
  const token = m[1];
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET!; // guaranteed: checked before we get here
  const userId = token ? verifyConnectToken(token, secret) : null;

  if (!userId) {
    await sendDm(message.chat.id, CONNECT_COPY.expired[lang]);
    return NextResponse.json({ status: 'ignored', reason: 'bad_connect_token' });
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await svc
    .from('profiles')
    .update({
      telegram_chat_id: message.chat.id,
      telegram_username: message.from?.username ?? null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[Telegram Webhook] connect update failed:', error.message);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }

  await sendDm(message.chat.id, CONNECT_COPY.ok[lang]);
  console.log(`[Telegram Webhook] linked chat ${message.chat.id} → user ${userId}`);
  return NextResponse.json({ status: 'connected' });
}

export async function POST(req: Request) {
  // ── 1. Require the webhook secret ─────────────────────────────────────
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    // Refuse to accept unauthenticated webhooks if the secret isn't configured
    return NextResponse.json(
      { status: 'error', message: 'TELEGRAM_WEBHOOK_SECRET not configured' },
      { status: 500 },
    );
  }

  const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
  if (incomingSecret !== expectedSecret) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  // ── 2. Process the message ────────────────────────────────────────────
  try {
    const body = await req.json();

    // Cap payload sizes — refuse anything wildly large that could be a DoS attempt
    const message = body.message || body.channel_post;
    if (!message || typeof message.text !== 'string') {
      return NextResponse.json({ status: 'ignored', reason: 'no text provided' });
    }
    if (message.text.length > 8_000) {
      return NextResponse.json({ status: 'ignored', reason: 'text too long' });
    }

    // Account-connect deep link takes priority; other texts flow to ingestion.
    const connectRes = await handleConnectStart(message);
    if (connectRes) return connectRes;

    const eventId = await ingestEventFromText(message.text);

    if (eventId) {
      console.log(`[Telegram Webhook] Inserted event: ${eventId}`);
      return NextResponse.json({ status: 'success', eventId });
    }
    return NextResponse.json({ status: 'ignored', reason: 'ai_filtered_or_duplicate' });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('[Telegram Webhook] Error:', msg);
    // Don't leak internal error details to attackers
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
