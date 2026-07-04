/**
 * Groq client for the standalone scripts — 6-key rotation.
 *
 * Unlike the serverless client (src/pipeline/groq.ts), these scripts run
 * locally with no function timeout, so on 429 they WAIT OUT the rate-limit
 * window (rather than hopping immediately). That behavioural difference is
 * why this is a separate class, not shared with the app.
 */

const MODEL            = 'llama-3.3-70b-versatile';
const RPM_TARGET       = 20;
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms between calls per key
const BACKOFF_429_MS   = 62_000;                         // full per-minute window reset
const FULL_RESET_MS    = 65_000;                         // wait when ALL keys are exhausted

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Rotates across N Groq API keys, waiting out 429s. Encapsulates rotation state. */
export class GroqClient {
  constructor(keys, model = MODEL) {
    if (!keys?.length) throw new Error('GroqClient needs at least one API key');
    this.keys = keys;
    this.model = model;
    this.keyIdx = 0;
    this.lastCallAt = keys.map(() => 0);
  }

  async call(prompt, maxTokens = 800) {
    for (let outer = 0; outer < 2; outer++) {
      for (let attempt = 0; attempt < this.keys.length; attempt++) {
        const idx = this.keyIdx % this.keys.length;
        this.keyIdx++;

        const gap = MIN_KEY_INTERVAL - (Date.now() - this.lastCallAt[idx]);
        if (gap > 0) await sleep(gap);
        this.lastCallAt[idx] = Date.now();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.keys[idx]}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(25_000),
        });

        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = retryAfter
            ? Math.max(parseInt(retryAfter, 10) * 1000 + 2_000, BACKOFF_429_MS)
            : BACKOFF_429_MS;
          process.stdout.write(` [key${idx} 429 — waiting ${Math.round(waitMs / 1000)}s]`);
          await sleep(waitMs);
          continue;
        }
        if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
        return (await res.json()).choices[0].message.content;
      }

      if (outer === 0) {
        process.stdout.write(` [all keys exhausted — waiting ${FULL_RESET_MS / 1000}s]`);
        await sleep(FULL_RESET_MS);
        this.lastCallAt = this.keys.map(() => 0);
      }
    }
    throw new Error('All Groq keys rate-limited after two passes — run again after a minute');
  }
}

/** Strip markdown fences, parse the first JSON object. Throws if unparseable. */
export function parseJSON(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]+\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  throw new Error(`Unparseable JSON: ${raw.slice(0, 100)}`);
}
