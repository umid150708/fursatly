/**
 * Groq client — 6-key rotation, serverless-friendly rate-limit handling.
 * Single model: llama-3.3-70b-versatile for every call.
 *
 * "Groq" is the inference provider; the model it runs is Meta's Llama-3.3-70B.
 *
 * Capacity (free tier, per key): 30 RPM, ~12 000 TPM, ~100 K tokens/day.
 * With 6 keys: ~600 K tokens/day total.
 *
 * Serverless guarantees (Vercel's 60s cap):
 *   • On 429: rotate to the next key IMMEDIATELY (no long sleep — a single long
 *     sleep would itself blow the function timeout).
 *   • If ALL keys 429 in one pass: throw. The cron treats it as a transient
 *     failure and retries on the next tick.
 *   • Min 3 s spacing between calls to the SAME key (20 RPM target).
 */

import { gemini } from './gemini';

const GROQ_MODEL       = 'llama-3.3-70b-versatile';
const RPM_TARGET       = 20;                             // 67% of the 30 RPM hard limit
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms between calls to SAME key

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Rotates across N Groq API keys, enforcing per-key spacing and hopping on 429.
 * Rotation state (round-robin index + per-key timestamps) is encapsulated here
 * rather than living as module globals.
 */
export class GroqClient {
  private readonly lastCallAt: number[];
  private keyIdx = 0;

  constructor(private readonly keys: string[], private readonly model = GROQ_MODEL) {
    this.lastCallAt = keys.map(() => 0);
  }

  /** Call Groq. Throws if every key is simultaneously throttled. */
  async call(prompt: string, maxTokens = 800): Promise<string> {
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const idx = this.keyIdx % this.keys.length;
      this.keyIdx++;

      // Enforce the minimum interval for this specific key (short wait, fits the budget).
      const gap = MIN_KEY_INTERVAL - (Date.now() - this.lastCallAt[idx]);
      if (gap > 0 && gap < 4_000) await sleep(gap);
      this.lastCallAt[idx] = Date.now();

      let res: Response;
      try {
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.keys[idx]}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        console.warn(`[Groq] Key ${idx} network error, hopping:`, err instanceof Error ? err.message : err);
        continue;
      }

      if (res.status === 429) { console.warn(`[Groq] Key ${idx} 429 — hopping`); continue; }
      if (!res.ok)            { console.warn(`[Groq] Key ${idx} HTTP ${res.status} — hopping`); continue; }

      const json = await res.json();
      return json.choices[0].message.content as string;
    }

    throw new Error(`All ${this.keys.length} Groq keys failed — will retry next cron tick`);
  }
}

/** Shared serverless instance, keyed from GROQ_KEY_1..6. */
export const groq = new GroqClient(
  [
    process.env.GROQ_KEY_1, process.env.GROQ_KEY_2, process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4, process.env.GROQ_KEY_5, process.env.GROQ_KEY_6,
  ].filter(Boolean) as string[],
);

/**
 * Primary LLM entry point for the whole pipeline. Tries Groq (6 keys); if every
 * Groq key is throttled, falls back to Gemini (3 keys) so a cron tick degrades
 * gracefully instead of failing. Throws only when BOTH providers are exhausted.
 */
export async function callLLM(prompt: string, maxTokens = 800): Promise<string> {
  try {
    return await groq.call(prompt, maxTokens);
  } catch (err) {
    if (gemini.available) {
      console.warn('[LLM] Groq exhausted — falling back to Gemini');
      return await gemini.call(prompt, maxTokens);
    }
    throw err;
  }
}

/**
 * Strips markdown fences then parses JSON. Throws if the response isn't parseable
 * so the caller can decide whether to retry.
 */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }

  const match = cleaned.match(/\{[\s\S]+\}/);
  if (match) {
    try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
  }

  throw new Error(`LLM returned unparseable JSON. Preview: ${raw.slice(0, 200)}`);
}
