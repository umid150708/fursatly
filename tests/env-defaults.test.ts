/**
 * .env.production is committed on purpose: it gives every build — including
 * Vercel preview builds, whose environment has no Supabase variables — the
 * PUBLIC config the root layout needs to prerender. Vercel's own env vars and
 * .env.local both take precedence over it, so production and local dev are
 * unaffected. Because the file is public, it must only ever hold values that
 * already ship to every browser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const entries = readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)] as const;
  });

describe('.env.production (committed build defaults)', () => {
  it('provides the public Supabase config the build needs', () => {
    const keys = entries.map(([k]) => k);
    expect(keys).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(keys).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('holds only NEXT_PUBLIC_ values — nothing server-side', () => {
    for (const [k] of entries) expect(k, k).toMatch(/^NEXT_PUBLIC_/);
  });

  it('never carries a secret or service-role key', () => {
    for (const [k, v] of entries) {
      expect(v, k).not.toMatch(/^sb_secret_/);          // Supabase secret key
      expect(v, k).not.toMatch(/service_role/i);
      if (v.startsWith('eyJ')) {                         // legacy JWT key: must be the anon role
        const payload = JSON.parse(Buffer.from(v.split('.')[1], 'base64url').toString());
        expect(payload.role, k).toBe('anon');
      }
    }
  });

  it('uses the publishable key format for the anon key', () => {
    const anon = entries.find(([k]) => k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY')?.[1] ?? '';
    expect(anon.startsWith('sb_publishable_') || anon.startsWith('eyJ')).toBe(true);
  });
});
