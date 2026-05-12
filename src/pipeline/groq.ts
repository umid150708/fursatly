/**
 * Groq client — 6-key rotation, tiered model routing, serverless-friendly
 * rate-limit handling, OpenRouter fallback.
 *
 * Strategy
 * ────────
 * The wrong way: send every call to the strongest (and most quota-limited)
 * model on a single rotating pool. We exhaust 70B quota in a few hundred
 * calls/day, then everything stalls.
 *
 * The right way (this file): route by task difficulty.
 *   • 'smart' tier → llama-3.3-70b-versatile  (extraction, enrichment research)
 *     ~ 100K tokens/day per key. We have 6 keys = ~600K tokens/day.
 *   • 'fast'  tier → llama-3.1-8b-instant     (translations, cleanup decisions)
 *     ~ 14M tokens/day per key. We have 6 keys = ~84M tokens/day.
 *
 * That's a ~140× capacity multiplier for the tasks that don't need 70B
 * reasoning — translation, classification, and short factual answers.
 * Each tier keeps its OWN round-robin index and its OWN per-key cooldowns,
 * so the two pools never compete for the same throughput budget.
 *
 * Serverless guarantees (Vercel's 60s cap):
 *   • On 429: rotate to next key IMMEDIATELY (no long sleep — that single
 *     sleep would itself blow the timeout). Other keys are independent.
 *   • If ALL keys 429 in a single pass: fall straight to OpenRouter.
 *   • Min 3s spacing between calls to the SAME key (20 RPM target) — short
 *     enough to fit inside the function budget.
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

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? '';

// ── Tier → model mapping ─────────────────────────────────────────────────────
export type ModelTier = 'smart' | 'fast';

const MODEL_BY_TIER: Record<ModelTier, string> = {
  smart: 'llama-3.3-70b-versatile',   // hard reasoning, JSON extraction, knowledge recall
  fast:  'llama-3.1-8b-instant',      // translation, short classifications, summaries
};

// OpenRouter fallback — also tiered so smart/fast each land somewhere reasonable.
const FALLBACK_MODEL_BY_TIER: Record<ModelTier, string> = {
  smart: 'meta-llama/llama-3.3-70b-instruct:free',
  fast:  'meta-llama/llama-3.2-3b-instruct:free',
};

// ── Rate-limit enforcement ───────────────────────────────────────────────────
// 20 RPM per key (67% of the 30 RPM hard limit — comfortable TPM headroom)
const RPM_TARGET       = 20;
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms between calls to SAME key

// Per-tier round-robin index + per-key cooldown timestamps. Each tier has its
// own state so the smart pool's pressure doesn't push the fast pool into 429s.
const tierState: Record<ModelTier, { keyIdx: number; lastCallAt: number[] }> = {
  smart: { keyIdx: 0, lastCallAt: GROQ_KEYS.map(() => 0) },
  fast:  { keyIdx: 0, lastCallAt: GROQ_KEYS.map(() => 0) },
};

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

/**
 * Call an LLM. Default tier is 'smart' (70B) so existing call sites
 * (extraction, enrichment research) keep working unchanged.
 * Pass tier='fast' for translation / classification work.
 */
export async function callLLM(prompt: string, maxTokens = 800, tier: ModelTier = 'smart'): Promise<string> {
  const state = tierState[tier];
  const model = MODEL_BY_TIER[tier];

  // Try each Groq key once. On 429, rotate immediately (no long sleep).
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const idx = state.keyIdx % GROQ_KEYS.length;
    state.keyIdx++;

    // Enforce minimum interval for this specific key in this tier
    const gap = MIN_KEY_INTERVAL - (Date.now() - state.lastCallAt[idx]);
    if (gap > 0 && gap < 4_000) await sleep(gap);

    state.lastCallAt[idx] = Date.now();
    const key = GROQ_KEYS[idx];

    let res: Response;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.warn(`[Groq:${tier}] Key ${idx} network error, hopping:`, err instanceof Error ? err.message : err);
      continue;
    }

    if (res.status === 429) {
      console.warn(`[Groq:${tier}] Key ${idx} 429 — hopping`);
      continue;
    }
    if (!res.ok) {
      console.warn(`[Groq:${tier}] Key ${idx} HTTP ${res.status} — hopping`);
      continue;
    }

    const json = await res.json();
    return json.choices[0].message.content as string;
  }

  // All Groq keys exhausted in this pass → OpenRouter fallback (no sleep)
  if (!OPENROUTER_KEY) throw new Error(`All Groq keys failed (tier=${tier}) — no OpenRouter key configured`);

  const fallbackModel = FALLBACK_MODEL_BY_TIER[tier];
  console.warn(`[Groq:${tier}] All keys exhausted — falling back to OpenRouter (${fallbackModel})`);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${OPENROUTER_KEY}`,
      'Content-Type':   'application/json',
      'HTTP-Referer':   'https://fursatly.uz',
    },
    body: JSON.stringify({
      model: fallbackModel,
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
