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
