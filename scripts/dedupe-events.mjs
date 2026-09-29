/**
 * Fursatly — retire duplicate listings already in the events table.
 *
 * Replays the ingestion rule (src/pipeline/dedupe.mjs) over the ACTIVE listings
 * in the order they were created: a listing is a duplicate when the ingestion
 * check would have rejected it against the ones posted before it. The earlier
 * listing is kept, since links already broadcast to the Telegram channel point
 * at it — unless the two disagree on the deadline by more than a few days, in
 * which case the later post is the fresher announcement and wins. The loser is
 * deactivated (is_active=false), not deleted, and marked with
 * research_data.duplicate_of so the enrich cron — which re-enriches inactive
 * rows — leaves it alone. Undo by flipping is_active back and removing the mark.
 *
 * Usage:
 *   node scripts/dedupe-events.mjs           → dry run: print the groups
 *   node scripts/dedupe-events.mjs --apply   → deactivate the duplicates
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/env.mjs';
import { findDuplicate } from '../src/pipeline/dedupe.mjs';

const APPLY = process.argv.includes('--apply');

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await supabase
  .from('events')
  .select('id, title, deadline, created_at, description, research_data')
  .eq('is_active', true)
  .order('created_at', { ascending: true })
  .limit(5000);
if (error) { console.error(error.message); process.exit(1); }

/** Days between two deadlines; null when either is missing. */
const gapDays = (a, b) =>
  a && b ? Math.abs(Date.parse(String(a).slice(0, 10)) - Date.parse(String(b).slice(0, 10))) / 86_400_000 : null;

// The post's own link, as ingestion compares it (see event-ingestion.ts).
for (const row of rows) {
  row.urls = [...String(row.description ?? '').matchAll(/🔗\s*(\S+)/g)].map((m) => m[1]);
}

const kept = [];
const dupes = [];
for (const row of rows) {
  const original = findDuplicate(row, kept);
  if (!original) { kept.push(row); continue; }
  const gap = gapDays(row.deadline, original.deadline);
  if (gap !== null && gap > 3) {
    // Conflicting deadlines: trust the fresher announcement.
    kept[kept.indexOf(original)] = row;
    dupes.push({ row: original, original: row });
  } else {
    dupes.push({ row, original });
  }
}

const day = (iso) => (iso ? String(iso).slice(0, 10) : 'rolling');
console.log(`${rows.length} active listings, ${dupes.length} duplicate(s)${APPLY ? '' : ' (dry run)'}\n`);
for (const { row, original } of dupes) {
  console.log(`  keep  ${day(original.deadline)}  ${original.title}`);
  console.log(`  drop  ${day(row.deadline)}  ${row.title}\n`);
}

if (APPLY && dupes.length) {
  for (const { row, original } of dupes) {
    // _attempts at the enrich cron's retry cap also keeps deployments older than
    // the duplicate_of check from picking the row up.
    const research_data = { ...(row.research_data ?? {}), duplicate_of: original.id, _attempts: 3 };
    const { error: upErr } = await supabase
      .from('events')
      .update({ is_active: false, research_data })
      .eq('id', row.id);
    if (upErr) { console.error(upErr.message); process.exit(1); }
  }
  console.log(`Deactivated ${dupes.length} listing(s): ${dupes.map((d) => d.row.id).join(', ')}`);
}
