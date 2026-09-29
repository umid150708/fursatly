/**
 * Content-Security-Policy: loose enough for the third parties the site really
 * uses, and no looser. The Telegram login widget on /auth loads a script from
 * telegram.org which embeds a sign-in iframe from oauth.telegram.org; without
 * both allowances the browser silently blocks it and the button never renders.
 */
import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

async function csp(): Promise<Record<string, string[]>> {
  const rules = await nextConfig.headers!();
  const header = rules.flatMap((r) => r.headers).find((h) => h.key === 'Content-Security-Policy');
  expect(header, 'CSP header present').toBeTruthy();
  const out: Record<string, string[]> = {};
  for (const part of header!.value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
}

describe('Content-Security-Policy', () => {
  it('lets the Telegram login widget load its script and its sign-in frame', async () => {
    const policy = await csp();
    expect(policy['script-src']).toContain('https://telegram.org');
    expect(policy['frame-src']).toContain('https://oauth.telegram.org');
  });

  it('does not let any other origin frame content in', async () => {
    const policy = await csp();
    expect(policy['frame-src']).toEqual(['https://oauth.telegram.org']);
  });

  it('keeps the protections that matter', async () => {
    const policy = await csp();
    expect(policy['default-src']).toEqual(["'self'"]);
    expect(policy['frame-ancestors']).toEqual(["'none'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['base-uri']).toEqual(["'self'"]);
  });
});
