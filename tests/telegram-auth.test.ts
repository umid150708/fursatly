/** Unit tests for Telegram login-widget verification — pure crypto, no network. */
import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'crypto';
import {
  buildDataCheckString,
  verifyTelegramAuth,
  telegramEmail,
  TELEGRAM_AUTH_MAX_AGE_S,
  type TelegramAuthPayload,
} from '../src/lib/telegram-auth';

const BOT_TOKEN = '123456:TEST-TOKEN';

/** Signs a payload exactly the way Telegram's widget does. */
function sign(payload: Omit<TelegramAuthPayload, 'hash'>): TelegramAuthPayload {
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  const checkString = buildDataCheckString(payload as unknown as Record<string, unknown>);
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');
  return { ...payload, hash };
}

const NOW = 1_800_000_000; // fixed unix time for determinism

const base = {
  id: 7_777_777,
  first_name: 'Aziza',
  username: 'aziza_uz',
  auth_date: NOW - 60, // 1 min ago
};

describe('buildDataCheckString', () => {
  it('sorts keys alphabetically and excludes hash', () => {
    const s = buildDataCheckString({ b: 2, a: 1, hash: 'x' });
    expect(s).toBe('a=1\nb=2');
  });
  it('drops undefined/null fields (widget omits empty ones)', () => {
    const s = buildDataCheckString({ a: 1, photo_url: undefined, last_name: null });
    expect(s).toBe('a=1');
  });
});

describe('verifyTelegramAuth', () => {
  it('accepts a correctly signed, fresh payload', () => {
    expect(verifyTelegramAuth(sign(base), BOT_TOKEN, NOW)).toEqual({ ok: true });
  });

  it('rejects a tampered payload (id swapped after signing)', () => {
    const forged = { ...sign(base), id: 999 };
    expect(verifyTelegramAuth(forged, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'bad_hash' });
  });

  it('rejects a payload signed with a different bot token', () => {
    const otherSecret = createHash('sha256').update('999:OTHER').digest();
    const checkString = buildDataCheckString(base as unknown as Record<string, unknown>);
    const hash = createHmac('sha256', otherSecret).update(checkString).digest('hex');
    expect(verifyTelegramAuth({ ...base, hash }, BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'bad_hash',
    });
  });

  it('rejects a stale auth_date (replay window)', () => {
    const stale = sign({ ...base, auth_date: NOW - TELEGRAM_AUTH_MAX_AGE_S - 1 });
    expect(verifyTelegramAuth(stale, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'stale' });
  });

  it('accepts right at the staleness boundary', () => {
    const edge = sign({ ...base, auth_date: NOW - TELEGRAM_AUTH_MAX_AGE_S });
    expect(verifyTelegramAuth(edge, BOT_TOKEN, NOW)).toEqual({ ok: true });
  });

  it('rejects malformed payloads', () => {
    expect(verifyTelegramAuth({} as TelegramAuthPayload, BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('rejects a hash of the wrong length without throwing', () => {
    const bad = { ...sign(base), hash: 'abcd' };
    expect(verifyTelegramAuth(bad, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'bad_hash' });
  });
});

describe('telegramEmail', () => {
  it('anchors the account at a deterministic synthetic address', () => {
    expect(telegramEmail(42)).toBe('tg-42@telegram.fursatly.uz');
  });
});
