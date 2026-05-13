import { NextResponse } from 'next/server';
import { ingestEventFromText } from '@/services/event-ingestion';

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
 */
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
