/**
 * Telegram Login Widget verification — pure functions, no env access.
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * The widget hands the browser a signed payload; the server must recompute
 * HMAC-SHA256(data_check_string, SHA256(bot_token)) and compare it to `hash`
 * before trusting any field. `auth_date` is also bounded to reject replays.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';

/** Raw payload posted by the Telegram login widget. */
export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** How stale an auth_date we accept, in seconds. */
export const TELEGRAM_AUTH_MAX_AGE_S = 60 * 60; // 1 hour

/** Builds the alphabetically-sorted `key=value` check string (hash excluded). */
export function buildDataCheckString(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter((k) => k !== 'hash' && payload[k] !== undefined && payload[k] !== null)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n');
}

export type TelegramVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'bad_hash' | 'stale' | 'malformed' };

/**
 * Verifies a Telegram login payload against the bot token.
 * `nowS` is injectable for tests (defaults to current unix time).
 */
export function verifyTelegramAuth(
  payload: TelegramAuthPayload,
  botToken: string,
  nowS: number = Math.floor(Date.now() / 1000),
): TelegramVerifyResult {
  if (!payload || typeof payload.id !== 'number' || typeof payload.hash !== 'string' || !payload.auth_date) {
    return { ok: false, reason: 'malformed' };
  }

  const secretKey = createHash('sha256').update(botToken).digest();
  const checkString = buildDataCheckString(payload as unknown as Record<string, unknown>);
  const expected = createHmac('sha256', secretKey).update(checkString).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(payload.hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_hash' };
  }

  if (nowS - payload.auth_date > TELEGRAM_AUTH_MAX_AGE_S) {
    return { ok: false, reason: 'stale' };
  }

  return { ok: true };
}

/** Synthetic email that anchors a Telegram-only account in Supabase auth. */
export function telegramEmail(telegramId: number): string {
  return `tg-${telegramId}@telegram.fursatly.uz`;
}
