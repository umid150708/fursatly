/**
 * Fursatly — Bulk Telegram Scraper
 *
 * Scrapes the last N days of posts from all configured channels.
 * Runs locally (no Vercel timeout). Shows live progress.
 *
 * Usage:
 *   node scripts/bulk-scrape.mjs          → last 7 days
 *   node scripts/bulk-scrape.mjs 14       → last 14 days
 *   node scripts/bulk-scrape.mjs 7 dry    → dry run (no DB inserts)
 */

import { load } from 'cheerio';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const DAYS_BACK  = parseInt(process.argv[2] ?? '7', 10);
const DRY_RUN    = process.argv.includes('dry');
const CHANNELS   = ['edugrandsuz', 'grantlar', 'Volunteensuz'];
const MIN_LENGTH = 80;   // ignore posts shorter than this

// ── Load env ──────────────────────────────────────────────────────────────────

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
const GROQ_KEYS = Object.entries(ENV).filter(([k]) => /^GROQ_KEY_\d+$/.test(k)).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v).filter(Boolean);
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

if (!GROQ_KEYS.length) { console.error('No GROQ_KEY_* found in .env.local'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

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

let keyIdx    = 0;
const lastCallAt = GROQ_KEYS.map(() => 0); // per-key last dispatch timestamp

async function callGroq(prompt, maxTokens = 600) {
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
        process.stdout.write(` [key${idx} rate-limited — waiting ${BACKOFF_429_MS/1000}s]`);
        await sleep(BACKOFF_429_MS);
        continue;
      }
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      const json = await res.json();
      return json.choices[0].message.content;  // success
    }

    // All keys were rate-limited in this pass
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

// ── Telegram scraper with pagination ─────────────────────────────────────────

async function fetchPage(channel, beforeId = null) {
  const url = beforeId
    ? `https://t.me/s/${channel}?before=${beforeId}`
    : `https://t.me/s/${channel}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fursatly/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${channel}`);
  return res.text();
}

function parseMessages(html) {
  const $ = load(html);
  const messages = [];

  $('.tgme_widget_message').each((_, el) => {
    const postAttr = $(el).attr('data-post') ?? '';
    const msgId = parseInt(postAttr.split('/')[1] ?? '0', 10);
    const dateEl = $(el).find('time');
    const datetime = dateEl.attr('datetime') ?? '';
    const textEl = $(el).find('.tgme_widget_message_text');
    textEl.find('br').replaceWith('\n');
    const text = textEl.text().trim();

    if (msgId && datetime && text.length >= MIN_LENGTH) {
      messages.push({ msgId, date: new Date(datetime), text });
    }
  });

  return messages;
}

async function scrapeChannelDays(channel, days) {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const collected = [];
  let beforeId = null;
  let pages = 0;
  const MAX_PAGES = 15;

  process.stdout.write(`  Fetching ${channel}`);

  while (pages < MAX_PAGES) {
    const html = await fetchPage(channel, beforeId);
    const msgs = parseMessages(html);

    if (!msgs.length) break;

    pages++;
    process.stdout.write(` [p${pages}: ${msgs.length} posts]`);

    // Keep only posts within our window
    const inWindow = msgs.filter(m => m.date >= cutoff);
    collected.push(...inWindow);

    // If the oldest post on this page is before our cutoff, we have all we need
    const oldest = msgs.reduce((a, b) => a.date < b.date ? a : b);
    if (oldest.date < cutoff) break;

    // Paginate: go further back using the smallest message ID on this page
    beforeId = Math.min(...msgs.map(m => m.msgId));

    // Small delay between page fetches to be polite
    await sleep(800);
  }

  process.stdout.write(` → ${collected.length} posts in last ${days} days\n`);
  return collected;
}

// ── URL extraction (free — no Groq needed) ────────────────────────────────────

/**
 * Pull every actionable URL / email / social handle out of raw post text.
 * Returns a deduplicated array of strings that the AI can use directly.
 */
function extractContactInfo(text) {
  const found = new Set();

  // Full URLs (http/https)
  const urls = text.match(/https?:\/\/[^\s\)\]>\"\']+/g) ?? [];
  urls.forEach(u => found.add(u.replace(/[.,;:!?]+$/, ''))); // strip trailing punctuation

  // Bare domains that look like apply links (e.g. forms.gle/..., apply.example.com)
  const bare = text.match(/(?<!\w)((?:apply|form|register|signup|application|join)\.[a-zA-Z0-9.\-\/]+)/gi) ?? [];
  bare.forEach(u => found.add(u));

  // Email addresses
  const emails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
  emails.forEach(e => found.add(e));

  return [...found];
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = (text, contactInfo) => `You are an event extraction engine for Fursatly, a platform for Uzbek students.

Extract structured data from this Telegram post. Return ONLY valid JSON — no markdown, no explanation.

${contactInfo.length > 0 ? `URLs / contacts found in this post (use these directly — do not invent others):
${contactInfo.map(c => '  • ' + c).join('\n')}

` : ''}{
  "is_valid_opportunity": boolean,
  "title": string,
  "description": string,
  "location": string,
  "age": { "min": number | null, "max": number | null },
  "language": "English" | "Uzbek" | "Russian",
  "deadline": "YYYY-MM-DD" | null,
  "category": "Scholarships" | "Competitions" | "Summer Programs" | "Research" | "Volunteer" | "STEM" | "Internships" | "Workshops",
  "apply_url": string | null
}

Rules:
- is_valid_opportunity = false if ANY of these apply:
  • It is an ad, spam, self-promotion, or unrelated chat
  • It is a local/offline-only event with NO online application link, NO website URL, NO email address, and NO social media handle — users must be able to act on it remotely
  • It is purely informational (e.g. "here is a list of deadlines this week") with no single apply-able opportunity
- is_valid_opportunity = true ONLY if a student can apply, register, or contact the organiser via a URL, email, or social handle present in the post
- apply_url: copy the most relevant URL or email from the "URLs / contacts found" list above — the one a student would click to apply or learn more. If the list is empty, return null.
- deadline: ISO date ONLY if explicitly stated — otherwise null
- age: only if explicitly stated — otherwise null
- NEVER invent information

Post:
${text}`;

async function ingestPost(text, stats) {
  // Step 1: Pull URLs/emails from raw post text — FREE, no Groq needed
  const contactInfo = extractContactInfo(text);

  // Step 2: Extract structured data via Groq
  let extracted;
  try {
    const raw = await callGroq(EXTRACTION_PROMPT(text, contactInfo));
    extracted = parseJSON(raw);
  } catch (e) {
    stats.errors++;
    return `extraction_error: ${e.message.slice(0, 60)}`;
  }

  if (!extracted.is_valid_opportunity) {
    stats.skipped++;
    return 'skipped_ad';
  }

  if (DRY_RUN) {
    stats.wouldInsert++;
    return `dry_run: "${extracted.title}" (apply: ${extracted.apply_url ?? 'none'})`;
  }

  // Deduplicate
  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .ilike('title', extracted.title.trim())
    .limit(1);

  if (existing?.length) {
    stats.duplicates++;
    return 'duplicate';
  }

  // Parse deadline
  let deadlineIso = null;
  if (extracted.deadline) {
    const d = new Date(extracted.deadline);
    if (!isNaN(d.getTime())) deadlineIso = d.toISOString();
  }

  // Append apply_url to description so enrichment finds it without extra Groq lookups
  const applyUrl = extracted.apply_url?.trim() || null;
  const descriptionWithUrl = applyUrl
    ? `${extracted.description}\n\n🔗 ${applyUrl}`
    : extracted.description;

  // Insert
  const { data: inserted, error } = await supabase
    .from('events')
    .insert({
      title:       extracted.title,
      description: descriptionWithUrl,
      location:    extracted.location,
      deadline:    deadlineIso,
      language:    extracted.language,
      source:      extracted.category ?? null,
      is_active:   false,
      age_min:     extracted.age?.min ?? 0,
      age_max:     extracted.age?.max ?? 100,
    })
    .select('id')
    .single();

  if (error) {
    stats.errors++;
    return `insert_error: ${error.message.slice(0, 60)}`;
  }

  stats.inserted++;
  return `inserted: "${extracted.title}" (apply: ${applyUrl ?? 'none'})`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearLine() { process.stdout.write('\r\x1b[K'); }

function printProgress(stats, total, current) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  clearLine();
  process.stdout.write(
    `  [${bar}] ${pct}% | ✅ ${stats.inserted} inserted | ⏭️  ${stats.skipped} skipped | 🔁 ${stats.duplicates} dupes | ❌ ${stats.errors} errors`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Fursatly Bulk Scraper`);
  console.log(`   Days back:  ${DAYS_BACK}`);
  console.log(`   Channels:   ${CHANNELS.join(', ')}`);
  console.log(`   Dry run:    ${DRY_RUN}`);
  console.log(`   Groq keys:  ${GROQ_KEYS.length}`);
  console.log('');

  // ── Phase 1: Collect all posts ──────────────────────────────────────────────
  console.log('📡 Phase 1: Scraping Telegram channels...');

  const allPosts = [];
  for (const channel of CHANNELS) {
    try {
      const posts = await scrapeChannelDays(channel, DAYS_BACK);
      allPosts.push(...posts.map(p => ({ ...p, channel })));
    } catch (e) {
      console.error(`  ❌ ${channel}: ${e.message}`);
    }
    await sleep(500);
  }

  // Deduplicate by text similarity before calling AI
  const uniquePosts = allPosts.filter((p, i, arr) =>
    arr.findIndex(q => q.text.slice(0, 100) === p.text.slice(0, 100)) === i
  );

  console.log(`\n  Found ${allPosts.length} posts (${uniquePosts.length} unique after dedup)\n`);

  if (!uniquePosts.length) {
    console.log('No posts found. Done.');
    return;
  }

  // ── Phase 2: Process through AI + DB ───────────────────────────────────────
  console.log('🤖 Phase 2: Extracting + inserting via Groq...');
  console.log(`   Processing ${uniquePosts.length} posts (≤25 RPM per key, auto-paced)\n`);

  const stats = { inserted: 0, skipped: 0, duplicates: 0, errors: 0, wouldInsert: 0 };
  const log = [];

  for (let i = 0; i < uniquePosts.length; i++) {
    const post = uniquePosts[i];

    printProgress(stats, uniquePosts.length, i);

    const result = await ingestPost(post.text, stats);
    log.push({ channel: post.channel, date: post.date.toISOString().slice(0, 10), result });
    // No manual sleep — callGroq's per-key interval enforces rate limits automatically
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  clearLine();
  console.log('\n✅ Done!\n');
  console.log('━'.repeat(50));
  console.log(`  ✅ Inserted:    ${stats.inserted}`);
  console.log(`  ⏭️  Skipped:     ${stats.skipped} (ads/invalid)`);
  console.log(`  🔁 Duplicates:  ${stats.duplicates}`);
  console.log(`  ❌ Errors:      ${stats.errors}`);
  if (DRY_RUN) console.log(`  🔍 Would insert: ${stats.wouldInsert}`);
  console.log('━'.repeat(50));

  if (stats.inserted > 0) {
    console.log(`\n📋 Inserted events:`);
    log.filter(l => l.result.startsWith('inserted')).forEach(l => {
      console.log(`  [${l.channel}] ${l.date} — ${l.result.replace('inserted: ', '')}`);
    });
  }

  if (!DRY_RUN && stats.inserted > 0) {
    console.log(`\n⏳ ${stats.inserted} events are now queued for AI enrichment.`);
    console.log(`   Hit /api/cron/enrich?secret=<CRON_SECRET> to process them,`);
    console.log(`   or check progress at /api/admin/progress`);
  }
}

main().catch(e => { console.error('\n💥 Fatal:', e); process.exit(1); });
