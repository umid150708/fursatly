/**
 * Stateless Telegram connect token.
 *
 * Links a signed-in Fursatly account to a Telegram chat without any DB table:
 * the /account page mints `t.me/<bot>?start=<token>`, and when Telegram
 * delivers `/start <token>` to the webhook we recover the user id from the
 * token itself. HMAC-signed with TELEGRAM_WEBHOOK_SECRET, short-lived, and
 * shaped to Telegram's start-payload rules (≤64 chars of [A-Za-z0-9_-]).
 *
 * Format: <uuid-hex32>_<expiry-epoch-s>_<hmac-16hex>
 */
import { createHmac, timingSafeEqual } from 'crypto';

export const CONNECT_TOKEN_TTL_S = 15 * 60; // 15 minutes — one tap, not a bearer credential

const SIG_LEN = 16;

const sig = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex').slice(0, SIG_LEN);

/** uuid with dashes → 32-char hex, and back. */
const packUuid = (uuid: string): string => uuid.replace(/-/g, '');
const unpackUuid = (hex: string): string =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

export function signConnectToken(userId: string, secret: string, now: Date = new Date()): string {
  const packed = packUuid(userId);
  const exp = Math.floor(now.getTime() / 1000) + CONNECT_TOKEN_TTL_S;
  const payload = `${packed}_${exp}`;
  return `${payload}_${sig(payload, secret)}`;
}

/** Returns the user id for a valid, unexpired token; null for anything else. */
export function verifyConnectToken(token: string, secret: string, now: Date = new Date()): string | null {
  const m = /^([0-9a-f]{32})_(\d{1,12})_([0-9a-f]{16})$/.exec(token ?? '');
  if (!m) return null;
  const [, packed, expStr, gotSig] = m;

  const expected = sig(`${packed}_${expStr}`, secret);
  // Both sides are fixed-length lowercase hex — safe for timingSafeEqual.
  if (!timingSafeEqual(Buffer.from(gotSig), Buffer.from(expected))) return null;

  if (Math.floor(now.getTime() / 1000) > Number(expStr)) return null;
  return unpackUuid(packed);
}
