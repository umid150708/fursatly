/**
 * Google stopped serving gemini-2.5-flash to new API keys (404 "no longer
 * available to new users"), so a freshly issued key could never answer. The
 * client must ask for a model every key can use, with thinking off, and the
 * shared pool must pick up the fourth key.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiClient } from '../src/pipeline/gemini';

const okResponse = () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('GeminiClient', () => {
  it('asks for a model new keys can use, with thinking off', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    expect(await new GeminiClient(['test-key']).call('hi', 8)).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/models/gemini-3.5-flash:generateContent');
    expect(JSON.parse(init.body).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('pools GEMINI_API_KEY through GEMINI_API_KEY_4', async () => {
    for (const suffix of ['', '_2', '_3', '_4']) vi.stubEnv(`GEMINI_API_KEY${suffix}`, `key${suffix}`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    const { gemini } = await import('../src/pipeline/gemini');
    await expect(gemini.call('hi', 8)).rejects.toThrow('All 4 Gemini keys failed');
  });
});

/**
 * On 30 Sep 2026 gemini-3.5-flash took 8–27s per answer on every key, and the
 * mentor tried Gemini first with 20s per key before reaching Groq. A client can
 * now carry a per-request timeout and a total budget: a slow key gives way,
 * fast refusals still hop keys, and nothing waits past the budget.
 */
describe('GeminiClient time limits', () => {
  /** A fetch that answers after `ms`, or rejects when its signal aborts first. */
  const slowFetch = (ms: number, status = 200) =>
    vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const t = setTimeout(() => resolve(status === 200 ? okResponse() : new Response('{}', { status })), ms);
        init.signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
      }));

  it('gives up on a slow key once the budget is spent', async () => {
    const fetchMock = slowFetch(5_000);
    vi.stubGlobal('fetch', fetchMock);
    const started = Date.now();
    await expect(new GeminiClient(['k1', 'k2', 'k3'], undefined, { timeoutMs: 40, budgetMs: 60 }).call('hi', 8)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('still hops past a fast refusal within the budget', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    expect(await new GeminiClient(['k1', 'k2'], undefined, { timeoutMs: 500, budgetMs: 1_000 }).call('hi', 8)).toBe('ok');
  });
});
