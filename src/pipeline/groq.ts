/**
 * Groq client with 5-key rotation, serverless-friendly rate-limit handling,
 * and OpenRouter fallback.
 *
 * Rate-limit rules (Groq free/dev tier): 30 RPM per key, ~14 400 TPM per key.
 *
 * Designed for Vercel's 60-second function timeout:
 *   - On 429: rotate to next key IMMEDIATELY (no long sleep — that would
 *     blow the timeout). Other keys are independent and likely still good.
 *   - If ALL keys 429 in a single pass: fall straight to OpenRouter rather
 *     than sleeping 60+ s waiting for the per-minute window to reset.
 *   - Minimum 3 s spacing between calls to the SAME key (20 RPM target) is
 *     still enforced — that's a short wait, fine inside the timeout.
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
// Free, fast, known-good OpenRouter model — used when ALL Groq keys are 429
const FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

// ── Rate-limit enforcement ────────────────────────────────────────────────────
// 20 RPM per key (67% of the 30 RPM hard limit — comfortable TPM headroom)
const RPM_TARGET       = 20;
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms between calls to SAME key

// Per-key timestamp of last successful call dispatch
const lastCallAt: number[] = GROQ_KEYS.map(() => 0);

// Round-robin index — persists across calls within the same serverless invocation
let keyIdx = 0;

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

export async function callLLM(prompt: string, maxTokens = 800): Promise<string> {
  // Try each Groq key once. On 429, rotate immediately (no long sleep).
  // Other Groq keys are independent — one being throttled doesn't affect the others.
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
      console.warn(`[Groq] Key ${idx} rate-limited — hopping to next key`);
      continue; // don't sleep — just rotate
    }
    if (!res.ok) {
      console.warn(`[Groq] Key ${idx} HTTP ${res.status} — hopping`);
      continue;
    }

    const json = await res.json();
    return json.choices[0].message.content as string;
  }

  // All Groq keys exhausted in this pass → OpenRouter fallback (no sleep)
  if (!OPENROUTER_KEY) throw new Error('All Groq keys failed — no OpenRouter key configured');

  console.warn('[Groq] All keys exhausted — falling back to OpenRouter');
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
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 120)).catch(() => '')}`);
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
