/** Fallback ordering for the chat LLM wrapper — no network, fake providers. */
import { describe, it, expect, vi } from 'vitest';
import { mentorLLM, type LLMProvider } from '../src/pipeline/mentor-llm';

const ok = (text: string): LLMProvider => ({ call: vi.fn().mockResolvedValue(text) });
const fail = (): LLMProvider => ({ call: vi.fn().mockRejectedValue(new Error('throttled')) });

describe('mentorLLM', () => {
  it('uses the first provider when it succeeds', async () => {
    const first = ok('from-gemini');
    const second = ok('from-groq');
    const out = await mentorLLM('hi', 100, [first, second]);
    expect(out).toBe('from-gemini');
    expect(second.call).not.toHaveBeenCalled();
  });

  it('falls back to the next provider when the first throws', async () => {
    const out = await mentorLLM('hi', 100, [fail(), ok('from-groq')]);
    expect(out).toBe('from-groq');
  });

  it('skips providers marked unavailable', async () => {
    const unavailable: LLMProvider = { call: vi.fn(), available: false };
    const out = await mentorLLM('hi', 100, [unavailable, ok('from-groq')]);
    expect(out).toBe('from-groq');
    expect(unavailable.call).not.toHaveBeenCalled();
  });

  it('throws when every provider fails', async () => {
    await expect(mentorLLM('hi', 100, [fail(), fail()])).rejects.toThrow();
  });
});
