/** Unit tests for the stateless Telegram connect token — pure crypto, no I/O. */
import { describe, it, expect } from 'vitest';
import { signConnectToken, verifyConnectToken, CONNECT_TOKEN_TTL_S } from '../src/lib/connect-token';

const SECRET = 'test-webhook-secret';
const USER = '4ad634f9-05bd-48a1-bd5b-a35a9d5e4dce';
const NOW = new Date('2026-07-18T12:00:00Z');

describe('signConnectToken', () => {
  it('stays within Telegram start-payload rules (≤64 chars, [A-Za-z0-9_-])', () => {
    const token = signConnectToken(USER, SECRET, NOW);
    expect(token.length).toBeLessThanOrEqual(64);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('verifyConnectToken', () => {
  it('round-trips back to the original user id', () => {
    const token = signConnectToken(USER, SECRET, NOW);
    expect(verifyConnectToken(token, SECRET, NOW)).toBe(USER);
  });

  it('rejects a tampered token', () => {
    const token = signConnectToken(USER, SECRET, NOW);
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(verifyConnectToken(tampered, SECRET, NOW)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signConnectToken(USER, 'other-secret', NOW);
    expect(verifyConnectToken(token, SECRET, NOW)).toBeNull();
  });

  it('rejects an expired token but accepts one inside the TTL', () => {
    const token = signConnectToken(USER, SECRET, NOW);
    const justInside = new Date(NOW.getTime() + (CONNECT_TOKEN_TTL_S - 5) * 1000);
    const justPast = new Date(NOW.getTime() + (CONNECT_TOKEN_TTL_S + 5) * 1000);
    expect(verifyConnectToken(token, SECRET, justInside)).toBe(USER);
    expect(verifyConnectToken(token, SECRET, justPast)).toBeNull();
  });

  it('rejects garbage without throwing', () => {
    for (const junk of ['', 'hello', 'a_b_c', '/start', 'x'.repeat(200)]) {
      expect(verifyConnectToken(junk, SECRET, NOW)).toBeNull();
    }
  });
});
