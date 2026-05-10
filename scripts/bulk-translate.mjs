/**
 * Fursatly — Bulk Translation Runner
 *
 * Finds enriched active events missing Russian translations (and optionally
 * missing Uzbek translations) and translates them using Groq.
 *
 * Steps per event:
 *   1. Check if uz translation is missing → call Groq to translate to Uzbek
 *   2. Check if ru translation is missing → call Groq to translate to Russian
 *   3. Merge new translations into existing research_data and update DB
 *
 * Usage:
 *   node scripts/bulk-translate.mjs          → translate all missing
 *   node scripts/bulk-translate.mjs dry      → dry run, no DB writes
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ── Config ─────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('dry');

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
const GROQ_KEYS    = Object.entries(ENV).filter(([k]) => /^GROQ_KEY_d+$/.test(k)).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v).filter(Boolean);
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

if (!GROQ_KEYS.length) { console.error('No GROQ_KEY_* in .env.local'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Groq client — strict rate-limit compliance ────────────────────────────────
//
// Same rate-limit logic as bulk-enrich.mjs:
// RPM_TARGET=20, MIN_KEY_INTERVAL=3000ms, BACKOFF_429_MS=62000ms, FULL_RESET_MS=65000ms

const RPM_TARGET       = 20;
const MIN_KEY_INTERVAL = Math.ceil(60_000 / RPM_TARGET); // 3 000 ms minimum between calls per key
const BACKOFF_429_MS   = 62_000;
const FULL_RESET_MS    = 65_000;

let keyIdx = 0;
const lastCallAt = GROQ_KEYS.map(() => 0);

async function callGroq(prompt, maxTokens = 700) {
  // Outer retry: if ALL keys return 429, wait for the full per-minute window to reset, then retry once
  for (let outerAttempt = 0; outerAttempt < 2; outerAttempt++) {
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
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? Math.max(parseInt(retryAfter, 10) * 1000 + 2_000, BACKOFF_429_MS) : BACKOFF_429_MS;
        process.stdout.write(` [key${idx} 429 — waiting ${Math.round(waitMs/1000)}s]`);
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      const json = await res.json();
      return json.choices[0].message.content;
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
function translationPrompt(fields, language) {
  return `Translate to ${language}. Return ONLY the JSON object, no explanation.

${JSON.stringify(fields, null, 2)}

Rules:
- Keep the same JSON keys
- Arrays must stay as arrays of strings
- Translate naturally, not word-for-word
- ${language === 'Uzbek (Latin script)' ? 'Use Latin Uzbek script, not Cyrillic' : 'Use natural Russian'}`;
}

// ── Translate one event ────────────────────────────────────────────────────────
async function translateEvent(event, stats) {
  const rd = event.research_data;
  if (!rd) return 'skipped: no research_data';

  const existingUz = rd.translations?.uz;
  const existingRu = rd.translations?.ru;

  const needsUz = !existingUz;
  const needsRu = !existingRu;

  if (!needsUz && !needsRu) {
    stats.alreadyComplete++;
    return 'skipped: already has both translations';
  }

  const fieldsToTranslate = {
    title:               event.title,
    extendedDescription: rd.extendedDescription || '',
    eligibilityCriteria: rd.eligibilityCriteria || [],
    keyDetails:          rd.keyDetails || [],
    competitionTips:     rd.competitionTips || [],
  };

  let uzTranslation = existingUz;
  let ruTranslation = existingRu;

  // Translate to Uzbek only if missing
  if (needsUz) {
    try {
      const uzRaw = await callGroq(translationPrompt(fieldsToTranslate, 'Uzbek (Latin script)'), 700);
      uzTranslation = parseJSON(uzRaw);
      stats.translatedUz++;
    } catch (e) {
      process.stdout.write(` [uz_err: ${e.message.slice(0, 40)}]`);
    }
  }

  // Translate to Russian
  if (needsRu) {
    try {
      const ruRaw = await callGroq(translationPrompt(fieldsToTranslate, 'Russian'), 700);
      ruTranslation = parseJSON(ruRaw);
      stats.translatedRu++;
    } catch (e) {
      process.stdout.write(` [ru_err: ${e.message.slice(0, 40)}]`);
      stats.errors++;
      return `error: Russian translation failed — ${e.message.slice(0, 60)}`;
    }
  }

  if (DRY_RUN) {
    return `dry_run: would write uz=${!!uzTranslation} ru=${!!ruTranslation}`;
  }

  // Merge translations into existing research_data
  const updatedResearchData = {
    ...rd,
    translations: {
      uz: uzTranslation,
      ru: ruTranslation,
    },
  };

  const { error } = await supabase
    .from('events')
    .update({ research_data: updatedResearchData })
    .eq('id', event.id);

  if (error) {
    stats.errors++;
    return `db_error: ${error.message.slice(0, 60)}`;
  }

  return `translated: uz=${!!uzTranslation} ru=${!!ruTranslation} — "${event.title}"`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearLine() { process.stdout.write('\r\x1b[K'); }

function printProgress(stats, total, current) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  clearLine();
  process.stdout.write(
    `  [${bar}] ${pct}% | uz: ${stats.translatedUz} | ru: ${stats.translatedRu} | skipped: ${stats.alreadyComplete} | errors: ${stats.errors}`
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🌐 Fursatly Bulk Translation Runner`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Groq keys: ${GROQ_KEYS.length}`);
  console.log('');

  // Fetch active events that have research_data but are missing translations.ru
  // We fetch all active events with non-null research_data and filter client-side
  // because Supabase doesn't support deep JSONB path IS NULL filtering easily.
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, research_data')
    .eq('is_active', true)
    .not('research_data', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  if (!events?.length) {
    console.log('✅ No active enriched events found.\n');
    return;
  }

  // Filter to events missing Russian translation
  const needsWork = events.filter(ev => {
    const rd = ev.research_data;
    if (!rd || rd._failed || rd._skipped) return false;
    return !rd.translations?.ru;
  });

  console.log(`📋 Found ${events.length} active enriched events`);
  console.log(`   → ${needsWork.length} are missing Russian translation\n`);

  if (!needsWork.length) {
    console.log('✅ All events already have Russian translations.\n');
    return;
  }

  console.log(`🤖 Translating... (auto-paced — ≤20 RPM per key, 62 s backoff on 429)\n`);

  const stats = { translatedUz: 0, translatedRu: 0, alreadyComplete: 0, errors: 0 };
  const log   = [];

  for (let i = 0; i < needsWork.length; i++) {
    const event = needsWork[i];
    printProgress(stats, needsWork.length, i);

    const result = await translateEvent(event, stats);
    log.push({ title: event.title, result });

    // 8-second inter-event pause — translation is lighter than enrichment (max 2 Groq calls)
    if (i < needsWork.length - 1) await sleep(8_000);
  }

  // Summary
  clearLine();
  console.log('\n✅ Done!\n');
  console.log('━'.repeat(55));
  console.log(`  Total found:          ${needsWork.length}`);
  console.log(`  Translated to Uzbek:  ${stats.translatedUz}`);
  console.log(`  Translated to Russian:${stats.translatedRu}`);
  console.log(`  Skipped (both exist): ${stats.alreadyComplete}`);
  console.log(`  Errors:               ${stats.errors}`);
  console.log('━'.repeat(55));

  if (stats.errors > 0) {
    console.log('\n⚠️  Events with errors:');
    log.filter(l => l.result.startsWith('error') || l.result.startsWith('db_error'))
       .forEach(l => console.log(`  • ${l.title}: ${l.result}`));
  }

  console.log('');
}

main().catch(e => { console.error('\n💥 Fatal:', e); process.exit(1); });
