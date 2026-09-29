/**
 * The daily agent's view of production. Each case is a failure that went
 * unnoticed for weeks in Aug–Sep 2026: Vercel had no Gemini keys, Groq retired
 * its model, and nothing was ingested or enriched.
 */
import { describe, it, expect } from 'vitest';
import { missingEnv, pipelineCheck, probe, healthSummary } from '../src/pipeline/health';

const HOUR = 3_600_000;

describe('missingEnv', () => {
  const full = {
    NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's',
    CRON_SECRET: 'c', TELEGRAM_BOT_TOKEN: 't', GROQ_KEY_1: 'g', GEMINI_API_KEY_3: 'm',
  };

  it('is empty when every setting is there', () => {
    expect(missingEnv(full)).toEqual([]);
  });

  it('names a whole provider when none of its keys is set', () => {
    const { GEMINI_API_KEY_3, ...noGemini } = full;
    expect(missingEnv(noGemini)).toEqual(['GEMINI_API_KEY (any of 1–4)']);
    const { GROQ_KEY_1, ...noGroq } = full;
    expect(missingEnv(noGroq)).toEqual(['GROQ_KEY_1..6 (any)']);
  });

  it('names each missing required setting', () => {
    const { CRON_SECRET, TELEGRAM_BOT_TOKEN, ...rest } = full;
    expect(missingEnv(rest)).toEqual(['CRON_SECRET', 'TELEGRAM_BOT_TOKEN']);
  });
});

describe('pipelineCheck', () => {
  const now = Date.parse('2026-09-30T09:00:00Z');

  it('passes when listings are recent and nothing waits long', () => {
    const c = pipelineCheck({ newestListingAt: new Date(now - 20 * HOUR).toISOString(), oldestQueuedAt: null }, now);
    expect(c.ok).toBe(true);
  });

  it('fails when no listing arrived for three days', () => {
    const c = pipelineCheck({ newestListingAt: new Date(now - 80 * HOUR).toISOString(), oldestQueuedAt: null }, now);
    expect(c.ok).toBe(false);
    expect(c.detail).toContain('no new listing for 80h');
  });

  it('fails when a listing waits in the enrich queue past a day', () => {
    const c = pipelineCheck({
      newestListingAt: new Date(now - 2 * HOUR).toISOString(),
      oldestQueuedAt: new Date(now - 30 * HOUR).toISOString(),
    }, now);
    expect(c.ok).toBe(false);
    expect(c.detail).toContain('queued for 30h');
  });

  it('fails when the table has no listing at all', () => {
    expect(pipelineCheck({ newestListingAt: null, oldestQueuedAt: null }, now).ok).toBe(false);
  });
});

describe('probe', () => {
  it('reports a working call and how long it took', async () => {
    const c = await probe('gemini-1', async () => 'OK');
    expect(c).toMatchObject({ name: 'gemini-1', ok: true });
    expect(c.detail).toMatch(/^OK · \d+ms$/);
  });

  it('fails a call that answers but too slowly for a student', async () => {
    const c = await probe('gemini-2', () => new Promise((r) => setTimeout(() => r('OK'), 30)), 1_000, 10);
    expect(c.ok).toBe(false);
    expect(c.detail).toMatch(/^slow: \d+ms \(limit 10ms\)$/);
  });

  it('reports a failing call with its message', async () => {
    const c = await probe('groq-2', async () => { throw new Error('HTTP 404 model_not_found'); });
    expect(c).toMatchObject({ name: 'groq-2', ok: false, detail: 'HTTP 404 model_not_found' });
  });

  it('treats an empty answer as a failure', async () => {
    expect((await probe('mentor', async () => '  ')).ok).toBe(false);
  });

  it('gives up after the timeout', async () => {
    const c = await probe('slow', () => new Promise(() => {}), 20);
    expect(c).toMatchObject({ ok: false, detail: 'timed out after 20ms' });
  });
});

describe('healthSummary', () => {
  it('is ok only when every check is', () => {
    const good = { name: 'db', ok: true, detail: '' };
    const bad = { name: 'gemini-2', ok: false, detail: 'HTTP 404' };
    expect(healthSummary([good])).toEqual({ ok: true, failing: [], checks: [good] });
    expect(healthSummary([good, bad])).toEqual({ ok: false, failing: ['gemini-2'], checks: [good, bad] });
  });
});
