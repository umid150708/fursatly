/**
 * Groq retired llama-3.3-70b-versatile (every key answers 404 model_not_found),
 * so the mentor and every cron LLM call lost their Groq path at once. Both Groq
 * clients must ask for a model Groq still serves, with reasoning off so a small
 * max_tokens budget (pickOfficial asks for 8) isn't spent on hidden thinking.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GroqClient } from '../src/pipeline/groq';
import { GroqClient as ScriptGroqClient } from '../scripts/lib/groq.mjs';

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(fetchMock.mock.calls[0][1].body);

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ['app client', GroqClient],
  ['script client', ScriptGroqClient],
])('Groq %s', (_name, Client) => {
  it('asks for a model Groq still serves, with reasoning off', async () => {
    const fetchMock = stubFetch();
    const out = await new Client(['test-key']).call('hi', 8);
    expect(out).toBe('ok');
    const body = sentBody(fetchMock);
    expect(body.model).toBe('qwen/qwen3.8-27b');
    expect(body.reasoning_effort).toBe('none');
  });
});
