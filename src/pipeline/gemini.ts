/**
 * Gemini fallback client — 3-key rotation.
 *
 * Used ONLY when every Groq key is throttled (see callLLM in ./groq.ts), so the
 * enrichment/extraction pipeline degrades to Gemini instead of failing the cron
 * tick. This is the "work as a group, don't hit limits" safety net: total daily
 * capacity becomes Groq (6 keys) + Gemini (3 keys).
 *
 * Model: gemini-2.5-flash with thinking disabled (thinkingBudget: 0) — keeps the
 * free-tier output budget for the actual JSON answer and cuts latency.
 *
 * Serverless-friendly (Vercel 60s cap): on 429/error, hop to the next key
 * immediately rather than sleeping.
 */

const GEMINI_MODEL     = 'gemini-2.5-flash';
const RPM_TARGET       = 12;                             // conservative per-key pacing
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // ~5s between calls to SAME key

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class GeminiClient {
  private readonly lastCallAt: number[];
  private keyIdx = 0;

  constructor(private readonly keys: string[], private readonly model = GEMINI_MODEL) {
    this.lastCallAt = keys.map(() => 0);
  }

  get available(): boolean {
    return this.keys.length > 0;
  }

  /** Call Gemini. Throws if every key is throttled or the pool is empty. */
  async call(prompt: string, maxTokens = 800): Promise<string> {
    if (!this.keys.length) throw new Error('No Gemini keys configured');

    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const idx = this.keyIdx % this.keys.length;
      this.keyIdx++;

      const gap = MIN_KEY_INTERVAL - (Date.now() - this.lastCallAt[idx]);
      if (gap > 0 && gap < 4_000) await sleep(gap);
      this.lastCallAt[idx] = Date.now();

      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.keys[idx]}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: 0.2,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
            signal: AbortSignal.timeout(20_000),
          },
        );
      } catch (err) {
        console.warn(`[Gemini] Key ${idx} network error, hopping:`, err instanceof Error ? err.message : err);
        continue;
      }

      if (res.status === 429) { console.warn(`[Gemini] Key ${idx} 429 — hopping`); continue; }
      if (!res.ok)            { console.warn(`[Gemini] Key ${idx} HTTP ${res.status} — hopping`); continue; }

      const json = await res.json();
      const text: string =
        json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
      if (!text) { console.warn(`[Gemini] Key ${idx} empty/blocked response — hopping`); continue; }
      return text;
    }

    throw new Error(`All ${this.keys.length} Gemini keys failed`);
  }
}

/** Shared serverless instance, keyed from GEMINI_API_KEY(_2/_3). */
export const gemini = new GeminiClient(
  [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean) as string[],
);
