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

import { createClient } from '@supabase/supabase-js';
import { loadEnv, groqKeys } from './lib/env.mjs';
import { GroqClient, parseJSON } from './lib/groq.mjs';
import { findYouTubeVideos } from '../src/pipeline/youtube.mjs';
import { researchPrompt, translationPrompt } from '../src/pipeline/prompts.mjs';
import { detectFunding, qualityGate } from '../src/pipeline/quality.mjs';

// ── Config ─────────────────────────────────────────────────────────────────────
const DRY_RUN      = process.argv.includes('dry');
const MAX_ATTEMPTS = 3;

// ── Env + clients ──────────────────────────────────────────────────────────────
const ENV          = loadEnv();
const GROQ_KEYS    = groqKeys(ENV);
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

if (!GROQ_KEYS.length) { console.error('No GROQ_KEY_* in .env.local'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const groq     = new GroqClient(GROQ_KEYS);
const callGroq = (prompt, maxTokens) => groq.call(prompt, maxTokens);

// ── Prompts ────────────────────────────────────────────────────────────────────
// ── Funding detection ──────────────────────────────────────────────────────────
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
  const { pass, reason } = qualityGate(event, research);

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

  // Step 5: YouTube preparation videos (silent failure, skipped if already present)
  if (event.research_data?.preparationResources?.length) {
    research.preparationResources = event.research_data.preparationResources;
  } else {
    const videos = await findYouTubeVideos(callGroq, {
      title:       event.title,
      category:    event.source ?? 'Opportunity',
      description: research.extendedDescription,
    });
    if (videos.length) {
      research.preparationResources = videos;
      process.stdout.write(` [YT: ${videos.length} videos]`);
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
