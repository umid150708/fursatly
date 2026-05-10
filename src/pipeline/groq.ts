/**
 * Groq client with 3-key rotation, strict rate-limit compliance, and OpenRouter fallback.
 *
 * Rate limit rules (Groq free/dev tier):
 *   30 RPM per key, ~14 400 TPM per key.
 *   Safe target: 20 RPM per key → MIN_KEY_INTERVAL = 60 000 / 20 = 3 000 ms.
 *
 * On 429: wait 62 s (full per-minute window reset), then try the next key.
 * On ALL keys exhausted: wait 65 s, reset timestamps, retry the whole loop once.
 * Final fallback: OpenRouter if still exhausted after retry.
 */

const GROQ_KEYS = (
  [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4,
    process.env.GROQ_KEY_5,
  ].filter(Boolean) as string[]
);

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? '';
const GROQ_MODEL     = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'google/gemma-4-31b-it:free';

// ── Rate-limit enforcement ────────────────────────────────────────────────────
// 20 RPM per key (67% of the 30 RPM hard limit — comfortable TPM headroom)
const RPM_TARGET       = 20;
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms between calls to SAME key
const BACKOFF_429_MS   = 62_000;                          // wait full 62 s when a key returns 429
const FULL_RESET_MS    = 65_000;                          // wait when ALL keys are simultaneously exhausted

// Per-key timestamp of last successful call dispatch
const lastCallAt: number[] = GROQ_KEYS.map(() => 0);

// Round-robin index — persists across calls within the same serverless invocation
let keyIdx = 0;

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

export async function callLLM(prompt: string, maxTokens = 800): Promise<string> {
  // Outer retry: if ALL keys return 429, wait for the full per-minute window to reset, then retry once
  for (let outerAttempt = 0; outerAttempt < 2; outerAttempt++) {
    for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
      const idx = keyIdx % GROQ_KEYS.length;
      keyIdx++;

      // Enforce minimum interval for this key
      const gap = MIN_KEY_INTERVAL - (Date.now() - lastCallAt[idx]);
      if (gap > 0) await sleep(gap);

      lastCallAt[idx] = Date.now();
      const key = GROQ_KEYS[idx];

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (res.status === 429) {
        console.warn(`[Groq] Key ${idx} rate-limited — waiting ${BACKOFF_429_MS / 1000}s`);
        await sleep(BACKOFF_429_MS);
        continue;
      }
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 120))}`);

      const json = await res.json();
      return json.choices[0].message.content as string;
    }

    // All keys rate-limited in this pass — wait for window reset then retry
    if (outerAttempt === 0) {
      console.warn(`[Groq] All keys exhausted — waiting ${FULL_RESET_MS / 1000}s for rate-limit reset`);
      await sleep(FULL_RESET_MS);
      for (let i = 0; i < GROQ_KEYS.length; i++) lastCallAt[i] = 0;
    }
  }

  // All Groq keys rate-limited → OpenRouter fallback
  if (!OPENROUTER_KEY) throw new Error('All Groq keys rate-limited after retry — no OpenRouter key configured');

  console.warn('[Groq] All keys exhausted after retry — falling back to OpenRouter');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${OPENROUTER_KEY}`,
      'Content-Type':   'application/json',
      'HTTP-Referer':   'https://fursatly.uz',
    },
    body: JSON.stringify({
      model: FALLBACK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(40_000),
  });

  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const json = await res.json();
  return json.choices[0].message.content as string;
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
