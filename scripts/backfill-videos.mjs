/**
 * Fursatly — Preparation-Video Backfill
 *
 * Re-runs ONLY the YouTube step (multi-query finder in ./lib/youtube.mjs) over
 * existing active events that are thin on videos, and overwrites their
 * research_data.preparationResources. Nothing else in research_data is touched —
 * translations, tips, eligibility, funding all stay exactly as they are.
 *
 * Targets active events with fewer than MIN_VIDEOS preparation videos (default 2)
 * — i.e. the events currently showing 0 or 1 video. Events that already have a
 * healthy set are left alone.
 *
 * Usage:
 *   node scripts/backfill-videos.mjs            → backfill all thin events
 *   node scripts/backfill-videos.mjs dry        → dry run, no DB writes
 *   node scripts/backfill-videos.mjs 5          → only the first 5 (smoke test)
 *   node scripts/backfill-videos.mjs dry 5      → dry run on the first 5
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv, groqKeys } from './lib/env.mjs';
import { GroqClient } from './lib/groq.mjs';
import { findYouTubeVideos } from './lib/youtube.mjs';

// ── Config ─────────────────────────────────────────────────────────────────────
const DRY_RUN      = process.argv.includes('dry');
const LIMIT        = (() => { const n = process.argv.map(Number).find(x => Number.isInteger(x) && x > 0); return n ?? Infinity; })();
const MIN_VIDEOS   = 2;      // backfill events with fewer than this many videos
const EVENT_GAP_MS = 1_500;  // polite pause between events (2 YouTube fetches each)
const sleep        = ms => new Promise(r => setTimeout(r, ms));

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

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎬 Fursatly Preparation-Video Backfill`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Limit:   ${LIMIT === Infinity ? 'all' : LIMIT}`);
  console.log(`   Target:  active events with < ${MIN_VIDEOS} videos`);
  console.log(`   Groq keys: ${GROQ_KEYS.length}\n`);

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, source, research_data')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) { console.error('DB error:', error.message); process.exit(1); }

  // Only active events currently thin on videos.
  const thin = (events ?? []).filter(e => {
    const pr = e.research_data?.preparationResources;
    return (Array.isArray(pr) ? pr.length : 0) < MIN_VIDEOS;
  }).slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(`📋 ${thin.length} event(s) to backfill (of ${events?.length ?? 0} active)\n`);
  if (!thin.length) { console.log('✅ Nothing to do.\n'); return; }

  const stats = { updated: 0, unchanged: 0, errors: 0, totalVideos: 0 };

  for (let i = 0; i < thin.length; i++) {
    const ev = thin[i];
    const before = Array.isArray(ev.research_data?.preparationResources)
      ? ev.research_data.preparationResources.length : 0;

    process.stdout.write(`  [${i + 1}/${thin.length}] "${ev.title.slice(0, 48)}" (${before} → `);

    let videos = [];
    try {
      videos = await findYouTubeVideos(callGroq, {
        title:       ev.title,
        category:    ev.source ?? 'Opportunity',
        description: ev.research_data?.extendedDescription ?? '',
      });
    } catch (e) {
      stats.errors++;
      process.stdout.write(`error: ${String(e.message).slice(0, 40)})\n`);
      continue;
    }

    if (!videos.length) {
      stats.unchanged++;
      process.stdout.write(`0 found, kept existing)\n`);
      continue;
    }

    if (DRY_RUN) {
      stats.updated++;
      stats.totalVideos += videos.length;
      process.stdout.write(`${videos.length}) [dry]\n`);
      videos.forEach(v => console.log(`        • ${v.title.slice(0, 60)}${v.channel ? ` — ${v.channel}` : ''}`));
    } else {
      const { error: upErr } = await supabase
        .from('events')
        .update({ research_data: { ...ev.research_data, preparationResources: videos } })
        .eq('id', ev.id);
      if (upErr) {
        stats.errors++;
        process.stdout.write(`db_error: ${upErr.message.slice(0, 40)})\n`);
      } else {
        stats.updated++;
        stats.totalVideos += videos.length;
        process.stdout.write(`${videos.length}) ✅\n`);
      }
    }

    if (i < thin.length - 1) await sleep(EVENT_GAP_MS);
  }

  console.log('\n' + '━'.repeat(55));
  console.log(`  ✅ Updated:   ${stats.updated}${DRY_RUN ? ' (would update)' : ''}`);
  console.log(`  ➖ Unchanged: ${stats.unchanged} (no videos found)`);
  console.log(`  ❌ Errors:    ${stats.errors}`);
  console.log(`  🎞️  Videos:    ${stats.totalVideos} total (${stats.updated ? (stats.totalVideos / stats.updated).toFixed(1) : 0} avg)`);
  console.log('━'.repeat(55) + '\n');
}

main().catch(e => { console.error('\n💥 Fatal:', e); process.exit(1); });
