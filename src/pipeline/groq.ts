/**
 * Groq client — 6-key rotation, serverless-friendly rate-limit handling.
 * Pure Groq, single model: llama-3.3-70b-versatile for every call.
 *
 * Note: "Groq" is the inference provider; the model it runs is Meta's
 * Llama-3.3-70B. That's what Groq sells.
 *
 * Capacity (free tier, per key): 30 RPM, ~12 000 TPM, ~100 K tokens/day.
 * With 6 keys: ~600 K tokens/day total.
 *
 * Serverless guarantees (Vercel's 60s cap):
 *   • On 429: rotate to the next key IMMEDIATELY (no long sleep — that
 *     single sleep would itself blow the function timeout).
 *   • If ALL 6 keys 429 in one pass: throw. The enrich cron treats it as
 *     a transient failure and retries on the next 10-min tick.
 *   • Min 3 s spacing between calls to the SAME key (20 RPM target).
 */

const GROQ_KEYS = (
  [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4,
    process.env.GROQ_KEY_5,
    process.env.GROQ_KEY_6,
  ].filter(Boolean) as string[]
);

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ── Rate-limit enforcement ───────────────────────────────────────────────────
const RPM_TARGET       = 20;                                // 67% of the 30 RPM hard limit
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET);    // 3 000 ms between calls to SAME key

// Per-key timestamp of last dispatch + global round-robin index.
const lastCallAt: number[] = GROQ_KEYS.map(() => 0);
let keyIdx = 0;

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

/**
 * Call Groq. Always uses llama-3.3-70b-versatile.
 * Throws if all 6 keys are simultaneously throttled.
 */
export async function callLLM(prompt: string, maxTokens = 800): Promise<string> {
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const idx = keyIdx % GROQ_KEYS.length;
    keyIdx++;

    // Enforce minimum interval for this specific key (short wait, fits the budget)
    const gap = MIN_KEY_INTERVAL - (Date.now() - lastCallAt[idx]);
    if (gap > 0 && gap < 4_000) await sleep(gap);

    lastCallAt[idx] = Date.now();
    const key = GROQ_KEYS[idx];

    let res: Response;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
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

    if (res.status === 429) {
      console.warn(`[Groq] Key ${idx} 429 — hopping`);
      continue;
    }
    if (!res.ok) {
      console.warn(`[Groq] Key ${idx} HTTP ${res.status} — hopping`);
      continue;
    }

    const json = await res.json();
    return json.choices[0].message.content as string;
  }

  // All 6 keys 429/error → throw. Cron retries on next tick.
  throw new Error(`All ${GROQ_KEYS.length} Groq keys failed — will retry next cron tick`);
}

// Strips markdown fences then parses JSON.
// Throws if the response isn't parseable — caller decides whether to retry.
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/,   '')
    .trim();

  // First try the whole string
  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }

  // Extract the first {...} block (handles prose + JSON responses)
  const match = cleaned.match(/\{[\s\S]+\}/);
  if (match) {
    try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
  }

  throw new Error(`LLM returned unparseable JSON. Preview: ${raw.slice(0, 200)}`);
}
