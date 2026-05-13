/**
 * Fursatly — Bulk Enrichment Runner
 *
 * Processes all queued events (is_active=false, research_data=null)
 * through the AI enrichment pipeline locally — no Vercel timeout.
 *
 * Steps per event:
 *   1. Research  — Groq extracts eligibility, tips, key facts
 *   2. Translate — Groq translates key fields to Uzbek
 *   3. Funding   — Detect Full/Partial from text signals
 *   4. Gate      — Skip if title too short or deadline passed
 *   5. Activate  — is_active=true, research_data saved
 *
 * Usage:
 *   node scripts/bulk-enrich.mjs          → process all queued
 *   node scripts/bulk-enrich.mjs dry      → dry run, no DB writes
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ── Config ─────────────────────────────────────────────────────────────────────
const DRY_RUN      = process.argv.includes('dry');
const MAX_ATTEMPTS = 3;

// ── Load env ───────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync('/Users/user/Desktop/Fursatly/.env.local', 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
  } catch {
    console.error('Could not read .env.local'); process.exit(1);
  }
}

const ENV = loadEnv();
const GROQ_KEYS    = Object.entries(ENV).filter(([k]) => /^GROQ_KEY_\d+$/.test(k)).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v).filter(Boolean);
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

if (!GROQ_KEYS.length) { console.error('No GROQ_KEY_* in .env.local'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Groq client — strict rate-limit compliance ────────────────────────────────
//
// Groq free/dev tier: 30 RPM per key.
// Safe target: 25 RPM per key → one call per key every 2 400 ms minimum.
// On 429: wait 30 s (the per-minute window resets), then try next key.

const RPM_TARGET       = 20;                              // conservative: 20 RPM per key (67% of 30 limit)
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms minimum between calls per key
const BACKOFF_429_MS   = 62_000;                          // 62 s on rate-limit hit (full minute window reset)
const FULL_RESET_MS    = 65_000;                          // wait when ALL keys are exhausted

let keyIdx = 0;
const lastCallAt = GROQ_KEYS.map(() => 0); // per-key last dispatch timestamp

async function callGroq(prompt, maxTokens = 900) {
  // Outer retry: if ALL keys return 429, wait for the full per-minute window to reset, then retry once
  for (let outerAttempt = 0; outerAttempt < 2; outerAttempt++) {
    let allRateLimited = true;

    for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
      const idx = keyIdx % GROQ_KEYS.length;
      keyIdx++;

      // Enforce minimum interval for this specific key
      const gap = MIN_KEY_INTERVAL - (Date.now() - lastCallAt[idx]);
      if (gap > 0) await sleep(gap);
      lastCallAt[idx] = Date.now();

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEYS[idx]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (res.status === 429) {
        // Honour Groq's retry-after header if present; fall back to BACKOFF_429_MS
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? Math.max(parseInt(retryAfter, 10) * 1000 + 2_000, BACKOFF_429_MS) : BACKOFF_429_MS;
        process.stdout.write(` [key${idx} 429 — waiting ${Math.round(waitMs/1000)}s]`);
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      const json = await res.json();
      return json.choices[0].message.content;  // success
    }

    // All keys were rate-limited in this pass — wait for the full window to reset, then retry once
    if (outerAttempt === 0) {
      process.stdout.write(` [all keys exhausted — waiting ${FULL_RESET_MS/1000}s for rate-limit reset]`);
      await sleep(FULL_RESET_MS);
      for (let i = 0; i < GROQ_KEYS.length; i++) lastCallAt[i] = 0;
    }
  }
  throw new Error('All Groq keys rate-limited after two passes — run again after a minute');
}

function parseJSON(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]+\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  throw new Error(`Unparseable JSON: ${raw.slice(0, 100)}`);
}

// ── Prompts ────────────────────────────────────────────────────────────────────
function researchPrompt(title, description) {
  return `You are a research assistant for Fursatly, an opportunity platform for Uzbek students.

Analyze this opportunity and return ONLY a valid JSON object. No markdown, no explanation.

Title: ${title}
Description: ${(description ?? '').slice(0, 2000)}

Return this exact shape:
{
  "extendedDescription": "2-3 sentences: what this opportunity is, who benefits, why it matters",
  "eligibilityCriteria": ["requirement 1", "requirement 2"],
  "keyDetails": ["concrete fact 1 (prize/duration/benefit)", "fact 2"],
  "competitionTips": ["actionable tip a student can do today", "tip 2"],
  "officialWebsite": "https://... or null",
  "applyLabel": "Apply on official website",
  "confidence": 0.85
}

Rules:
- eligibilityCriteria: ONLY requirements EXPLICITLY stated. If none, return []. NEVER invent.
- keyDetails: numbers, dates, money, durations. Never repeat the description.
- competitionTips: actionable steps. Not "work hard". Not "be yourself".
- confidence: 0.0–1.0 based on clarity of source
- officialWebsite: the application/info URL. Check the description first — if it contains a 🔗 line, that IS the URL, copy it exactly. Otherwise use any URL in the description text. If none is present but you recognise the program, provide the correct official URL from your knowledge. Return null only if you genuinely cannot determine it.
- Arrays may be empty [] if there is genuinely nothing to add`;
}

function translationPrompt(fields, language) {
  return `Translate to ${language}. Return ONLY the JSON object, no explanation.

${JSON.stringify(fields, null, 2)}

Rules:
- Keep the same JSON keys
- Arrays must stay as arrays of strings
- Translate naturally, not word-for-word
- ${language === 'Uzbek (Latin script)' ? 'Use Latin Uzbek script, not Cyrillic' : 'Use natural Russian'}`;
}

// ── Funding detection ──────────────────────────────────────────────────────────
function detectFunding(research) {
  const text = [
    research.extendedDescription ?? '',
    ...(research.keyDetails ?? []),
    ...(research.eligibilityCriteria ?? []),
    ...(research.competitionTips ?? []),
  ].join(' ').toLowerCase();

  const fullSignals = [
    'fully funded', 'full fund', 'full scholarship', 'full grant', 'full coverage',
    'covers all', 'all expenses', 'all costs covered', "to'liq grant",
    "to'liq moliyalashtirish", 'полное финансирование',
    'stipend included', 'flight covered', 'accommodation covered', 'travel covered', '100%',
  ];
  const partialSignals = [
    'partial', 'qisman', 'частичное', 'contribution',
    'co-funded', 'partially covered', 'some expenses',
  ];

  if (fullSignals.some(s => text.includes(s))) return 'Full';
  if (partialSignals.some(s => text.includes(s))) return 'Partial';
  return null;
}

// ── Quality gate ───────────────────────────────────────────────────────────────
function qualityGate(event) {
  if (!event.title || event.title.trim().length < 8)
    return { pass: false, reason: `Title too short: "${event.title}"` };
  if (event.deadline) {
    const dl = new Date(event.deadline);
    if (!isNaN(dl.getTime()) && dl < new Date())
      return { pass: false, reason: `Deadline passed: ${event.deadline}` };
  }
  return { pass: true, reason: '' };
}

// ── YouTube search ─────────────────────────────────────────────────────────────
async function findYouTubeVideo(title, category) {
  try {
    // Ask Groq for the best search query (~30 tokens, very cheap)
    const query = (await callGroq(
      `A student wants to find a YouTube video to help them prepare for this opportunity:\n"${title}" (${category})\n\nWrite ONE concise YouTube search query (5-8 words) that would find the most useful how-to or advice video.\nReturn ONLY the search query — no quotes, no explanation.`,
      40
    )).trim().replace(/^["']|["']$/g, '');

    if (!query) return null;

    // Fetch YouTube search results page (no API key needed)
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`,
      {
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return null;

    const html = await res.text();

    // YouTube embeds search results as ytInitialData JSON in the page
    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!match) return null;

    const data     = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) return null;

    for (const item of contents) {
      const v = item?.videoRenderer;
      if (v?.videoId && v?.title?.runs?.[0]?.text) {
        return { url: `https://www.youtube.com/watch?v=${v.videoId}`, title: v.title.runs[0].text };
      }
    }
    return null;
  } catch {
    return null;  // silent failure — YouTube is optional
  }
}

// ── Enrich one event ───────────────────────────────────────────────────────────
async function enrichEvent(event, stats) {
  // Step 1: Research
  let research;
  try {
    const raw = await callGroq(researchPrompt(event.title, event.description), 900);
    research = parseJSON(raw);
    research.confidence     = Math.max(0, Math.min(1, Number(research.confidence) || 0.5));
    research.lastEnrichedAt = new Date().toISOString();
  } catch (e) {
    stats.errors++;
    if (!DRY_RUN) {
      const rd = (event.research_data ?? {});
      const attempts = rd._attempts ?? 0;
      await supabase.from('events').update({
        research_data: { _failed: true, _attempts: attempts + 1, _error: e.message.slice(0, 120), _failedAt: new Date().toISOString() }
      }).eq('id', event.id);
    }
    return `error: ${e.message.slice(0, 60)}`;
  }

  // Step 2: Translate to Uzbek (silent failure)
  const toTranslate = {
    title:               event.title,
    extendedDescription: research.extendedDescription,
    eligibilityCriteria: research.eligibilityCriteria,
    keyDetails:          research.keyDetails,
    competitionTips:     research.competitionTips,
  };

  let uzTranslation;
  try {
    const uzRaw = await callGroq(translationPrompt(toTranslate, 'Uzbek (Latin script)'), 700);
    uzTranslation = parseJSON(uzRaw);
  } catch {
    // Continue without Uzbek translation
  }

  // Step 2b: Translate to Russian (silent failure)
  let ruTranslation;
  try {
    const ruRaw = await callGroq(translationPrompt(toTranslate, 'Russian'), 700);
    ruTranslation = parseJSON(ruRaw);
  } catch {
    // Continue without Russian translation
  }

  research.translations = { uz: uzTranslation, ru: ruTranslation };

  // Step 3: Funding
  research.funding_type = detectFunding(research);

  // Step 4: Quality gate
  const { pass, reason } = qualityGate(event);

  if (DRY_RUN) {
    stats.wouldActivate++;
    return `dry_run: ${pass ? 'would activate' : `would skip (${reason})`} — "${research.extendedDescription?.slice(0, 60)}"`;
  }

  if (!pass) {
    await supabase.from('events').update({
      research_data: { ...research, _skipped: true, _skipReason: reason }
    }).eq('id', event.id);
    stats.skipped++;
    return `skipped: ${reason}`;
  }

  // Step 5: YouTube preparation video (silent failure, skipped if already present)
  if (event.research_data?.preparationResources?.length) {
    research.preparationResources = event.research_data.preparationResources;
  } else {
    const video = await findYouTubeVideo(event.title, event.source ?? 'Opportunity');
    if (video) {
      research.preparationResources = [video];
      process.stdout.write(` [YT: ${video.title.slice(0, 40)}]`);
    }
  }

  // Step 6: Activate
  const { error } = await supabase.from('events').update({
    is_active:     true,
    research_data: research,
  }).eq('id', event.id);

  if (error) {
    stats.errors++;
    return `db_error: ${error.message.slice(0, 60)}`;
  }

  stats.activated++;
  return `activated: "${event.title}"`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearLine() { process.stdout.write('\r\x1b[K'); }

function printProgress(stats, total, current) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  clearLine();
  process.stdout.write(
    `  [${bar}] ${pct}% | ✅ ${stats.activated} activated | ⏭️  ${stats.skipped} skipped | ❌ ${stats.errors} errors`
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔬 Fursatly Bulk Enrichment Runner`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Groq keys: ${GROQ_KEYS.length}`);
  console.log('');

  // Fetch all queued events (is_active=false, research_data IS NULL)
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, description, deadline, source, research_data')
    .eq('is_active', false)
    .is('research_data', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  if (!events?.length) {
    console.log('✅ Queue is empty — nothing to enrich.\n');
    return;
  }

  // Filter out exhausted events (shouldn't be null, but safety check)
  const eligible = events.filter(ev => {
    const rd = ev.research_data;
    if (!rd) return true;
    return (rd._attempts ?? 0) < MAX_ATTEMPTS;
  });

  console.log(`📋 Found ${eligible.length} events in queue\n`);
  console.log(`🤖 Processing... (auto-paced — ≤25 RPM per key, 30 s backoff on 429)\n`);

  const stats  = { activated: 0, skipped: 0, errors: 0, wouldActivate: 0 };
  const log    = [];

  for (let i = 0; i < eligible.length; i++) {
    const event = eligible[i];
    printProgress(stats, eligible.length, i);

    const result = await enrichEvent(event, stats);
    log.push({ title: event.title, result });

    // Small inter-event pause to spread token usage across the per-minute window.
    // Each enrichment uses ~2000-2500 tokens; with 3 keys @ 14 400 TPM each we can safely
    // process ~5 events/minute. 12 s gap → max 5 events/min, well within budget.
    if (i < eligible.length - 1) await sleep(12_000);
  }

  // Summary
  clearLine();
  console.log('\n✅ Done!\n');
  console.log('━'.repeat(55));
  console.log(`  ✅ Activated:  ${stats.activated}`);
  console.log(`  ⏭️  Skipped:    ${stats.skipped} (quality gate)`);
  console.log(`  ❌ Errors:     ${stats.errors}`);
  if (DRY_RUN) console.log(`  🔍 Would activate: ${stats.wouldActivate}`);
  console.log('━'.repeat(55));

  if (stats.activated > 0) {
    console.log('\n📋 Activated events:');
    log.filter(l => l.result.startsWith('activated'))
       .forEach(l => console.log(`  • ${l.title}`));
  }

  if (stats.errors > 0) {
    console.log('\n⚠️  Events with errors (will retry on next run):');
    log.filter(l => l.result.startsWith('error') || l.result.startsWith('db_error'))
       .forEach(l => console.log(`  • ${l.title}: ${l.result}`));
  }

  console.log(`\n🌐 Check progress: /api/admin/progress?secret=<CRON_SECRET>\n`);
}

main().catch(e => { console.error('\n💥 Fatal:', e); process.exit(1); });
