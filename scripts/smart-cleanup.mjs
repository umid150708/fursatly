/**
 * Fursatly — Smart No-Link Cleanup
 *
 * Finds active events with no contact link/URL in their data,
 * then asks Groq whether each event is a known/findable program.
 * - Known/Googleable → keep it (students can find it themselves)
 * - Unknown/local/obscure → delete it
 *
 * Usage:
 *   node scripts/smart-cleanup.mjs          → real run
 *   node scripts/smart-cleanup.mjs dry      → dry run (no deletions)
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv, groqKeys } from './lib/env.mjs';
import { GroqClient } from './lib/groq.mjs';

const DRY_RUN = process.argv.includes('dry');

// ── Env + clients ─────────────────────────────────────────────────────────────
const env       = loadEnv();
const GROQ_KEYS = groqKeys(env);
const supabase  = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!GROQ_KEYS.length) { console.error('No GROQ_KEY_* found'); process.exit(1); }

const groq     = new GroqClient(GROQ_KEYS);
const callGroq = (prompt, maxTokens) => groq.call(prompt, maxTokens).then(s => s.trim());
const sleep    = ms => new Promise(r => setTimeout(r, ms));

// ── Link detection ────────────────────────────────────────────────────────────
function hasLink(event) {
  const rd   = event.research_data || {};
  const desc = event.description   || '';
  if (rd.officialWebsite && typeof rd.officialWebsite === 'string' && rd.officialWebsite.startsWith('http')) return true;
  if (/https?:\/\/\S+/.test(desc))                                                   return true;
  if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(desc))               return true;
  if (/@\w{3,}/.test(desc) || /t\.me\/\w+/.test(desc))                               return true;
  return false;
}

// ── Groq: is this a known/Googleable program? ─────────────────────────────────
async function isKnownProgram(title, description) {
  const prompt = `You are helping curate an opportunity platform for students.

Event title: "${title}"
Short description: "${(description || '').slice(0, 300)}"

Question: Is this a real, named program, competition, scholarship, or opportunity that a student could find by searching its exact name on Google? (e.g. "IAAC astronomy competition", "Veritas AI Scholars", "Talaria Summer Institute" — these are all real findable programs)

Answer with ONLY one word: YES or NO.
- YES = it is a named real program students can Google
- NO = it is a local/informal/unnamed/generic event with no searchable identity`;

  const answer = await callGroq(prompt, 5);
  return answer.toUpperCase().startsWith('Y');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧹 Fursatly Smart Cleanup`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Groq keys: ${GROQ_KEYS.length}\n`);

  const { data: all } = await supabase
    .from('events')
    .select('id,title,description,research_data')
    .eq('is_active', true);

  const noLink = (all || []).filter(e => !hasLink(e));
  console.log(`📋 ${all?.length} total active events`);
  console.log(`🔗 ${noLink.length} have no link/contact — checking with Groq...\n`);

  const toDelete  = [];
  const toKeep    = [];
  let   processed = 0;

  for (const event of noLink) {
    processed++;
    process.stdout.write(`[${processed}/${noLink.length}] "${event.title?.slice(0, 50)}"...`);

    let known = false;
    try {
      known = await isKnownProgram(event.title, event.description);
    } catch (e) {
      process.stdout.write(` ⚠️  Groq error (keeping)\n`);
      toKeep.push(event.title);
      await sleep(8_000);
      continue;
    }

    if (known) {
      process.stdout.write(` ✅ KEEP (known program)\n`);
      toKeep.push(event.title);
    } else {
      process.stdout.write(` 🗑️  DELETE (local/unknown)\n`);
      toDelete.push(event);
    }

    // Pause between events to respect rate limits
    await sleep(8_000);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(55));
  console.log(`  ✅ Keep (known/Googleable): ${toKeep.length}`);
  console.log(`  🗑️  Delete (local/unknown):  ${toDelete.length}`);
  console.log('━'.repeat(55));

  if (toDelete.length === 0) {
    console.log('\nNothing to delete. Done!');
    return;
  }

  console.log('\nEvents to delete:');
  toDelete.forEach(e => console.log(`  • ${e.title}`));

  if (DRY_RUN) {
    console.log('\n[Dry run — no deletions made]');
    return;
  }

  // Delete in batches
  console.log('\nDeleting...');
  const ids = toDelete.map(e => e.id);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const { error } = await supabase.from('events').delete().in('id', batch);
    if (error) { console.error('Delete error:', error.message); break; }
    deleted += batch.length;
  }

  console.log(`\n✅ Deleted ${deleted} events.`);
  const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_active', true);
  console.log(`   Active events remaining: ${count}`);
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1); });
