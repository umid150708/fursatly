/**
 * Fursatly — Apply-link Backfill
 *
 * Walks every active event and repairs its `research_data.officialWebsite`:
 *   • de-aggregates reposter links (edugrants.uz / grantlar.uz) to the real
 *     official program page, and
 *   • validates that the final link resolves.
 *
 * Stores the outcome on research_data (no DB migration):
 *   officialWebsite   → best link we can stand behind
 *   linkStatus        → 'ok' | 'unverified' | 'dead' | 'contact' | 'none'
 *   linkResolvedFrom  → the aggregator URL we moved away from (or removed)
 *   linkCheckedAt     → ISO timestamp
 *
 * Runs locally under plain node (no Vercel timeout), politely throttled.
 *
 * Usage:
 *   node scripts/fix-apply-links.mjs          → apply fixes
 *   node scripts/fix-apply-links.mjs dry       → report only, no DB writes
 *   node scripts/fix-apply-links.mjs dry agg   → dry + only the aggregator links
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv, groqKeys } from './lib/env.mjs';
import { GroqClient } from './lib/groq.mjs';
import { resolveApplyLink, isAggregator } from '../src/pipeline/resolve-link.mjs';

const DRY_RUN  = process.argv.includes('dry');
const AGG_ONLY = process.argv.includes('agg');

const ENV = loadEnv();
const supabase = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const GROQ_KEYS = groqKeys(ENV);
const groq = GROQ_KEYS.length ? new GroqClient(GROQ_KEYS) : null;
const callLLM = groq ? (p, t) => groq.call(p, t) : undefined;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { data: events, error } = await supabase
  .from('events')
  .select('id, title, research_data')
  .eq('is_active', true);

if (error) { console.error('DB read failed:', error.message); process.exit(1); }

let queue = events.filter((e) => (e.research_data ?? {}).officialWebsite);
if (AGG_ONLY) queue = queue.filter((e) => isAggregator(e.research_data.officialWebsite));

console.log(`${DRY_RUN ? '[DRY] ' : ''}Checking ${queue.length} event(s)${AGG_ONLY ? ' (aggregator links only)' : ''}\n`);

const stats = { ok: 0, unverified: 0, dead: 0, contact: 0, deAggregated: 0, changed: 0 };

for (const ev of queue) {
  const rd = ev.research_data ?? {};
  const before = rd.officialWebsite;

  const { url, status, resolvedFrom } = await resolveApplyLink(before, { title: ev.title, callLLM });
  stats[status] = (stats[status] ?? 0) + 1;
  if (resolvedFrom) stats.deAggregated++;

  const changed = url !== before;
  if (changed) stats.changed++;

  const tag = resolvedFrom ? '🔀' : changed ? '✏️ ' : status === 'dead' ? '💀' : '  ';
  console.log(`${tag} [${status.padEnd(10)}] ${ev.title.slice(0, 44).padEnd(44)}`);
  if (resolvedFrom) console.log(`      ${resolvedFrom}\n   →  ${url}`);
  else if (changed)  console.log(`      ${before}\n   →  ${url}`);

  if (!DRY_RUN) {
    const { error: upErr } = await supabase
      .from('events')
      .update({
        research_data: {
          ...rd,
          officialWebsite: url,
          linkStatus: status,
          linkResolvedFrom: resolvedFrom,
          linkCheckedAt: new Date().toISOString(),
        },
      })
      .eq('id', ev.id);
    if (upErr) console.error(`   ⚠️  write failed: ${upErr.message}`);
  }

  await sleep(400); // politeness between outbound fetches
}

console.log(
  `\nDone. ok:${stats.ok} unverified:${stats.unverified} dead:${stats.dead} contact:${stats.contact}` +
  ` | de-aggregated:${stats.deAggregated} changed:${stats.changed}` +
  (DRY_RUN ? '  (dry run — no writes)' : ''),
);
