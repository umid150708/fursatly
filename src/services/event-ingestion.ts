'use server';
/**
 * Ingests a raw Telegram post into the events table.
 *
 * Works with the CURRENT database schema (no migration required).
 * Uses only columns that are confirmed to exist:
 *   id, title, description, location, deadline, language,
 *   source, is_active, age_min, age_max, created_at, research_data
 *
 * Queue signal: is_active=false + research_data IS NULL
 *   → picked up by the enrich cron
 */

import { extractEventDetails } from '@/ai/flows/extract-event-details-flow';
import { createClient } from '@supabase/supabase-js';

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('ey') ||
              process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_')
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

export async function ingestEventFromText(rawText: string): Promise<string | null> {
  // ── Step 1: Extract via Groq ────────────────────────────────────────────────
  const extracted = await extractEventDetails({ text: rawText });

  if (!extracted.is_valid_opportunity) {
    console.log(`[Ingest] 🛑 Skipping "${extracted.title}" — ad/invalid`);
    return null;
  }

  // Hard link guard — every event MUST ship with a contact path.
  // We require BOTH:
  //  (a) the raw post contains at least one URL / email / t.me link / @handle / bare domain, AND
  //  (b) the AI populated apply_url with one of those entries.
  // If the AI failed to pick one but the post clearly has contacts, we recover the
  // first URL/email/t.me/handle from the post text so we don't lose a good event.
  const applyUrlFromAi = (extracted as any).apply_url?.trim() || '';
  const rawHasContact =
    /https?:\/\/\S+/.test(rawText) ||
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(rawText) ||
    /(?:^|\s)t\.me\/[A-Za-z0-9_]{3,}/.test(rawText) ||
    /(?:^|\s)@[A-Za-z0-9_]{3,}\b/.test(rawText) ||
    /\b(?:www\.)?[a-z0-9][a-z0-9\-]+\.(?:com|org|net|edu|io|uz|ru|co|gov|info|app|ai)\b/i.test(rawText);

  if (!rawHasContact) {
    console.log(`[Ingest] 🔗 Skipping "${extracted.title}" — no contact info in post`);
    return null;
  }

  // If the AI dropped the apply_url, recover the first plausible contact from raw text
  if (!applyUrlFromAi) {
    const urlMatch    = rawText.match(/https?:\/\/[^\s\)\]>"']+/);
    const emailMatch  = rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const tmeMatch    = rawText.match(/t\.me\/[A-Za-z0-9_]{3,}/);
    const handleMatch = rawText.match(/(?:^|\s)@([A-Za-z0-9_]{3,})\b/);
    const recovered =
      urlMatch?.[0] ||
      (emailMatch?.[0] ? `mailto:${emailMatch[0]}` : '') ||
      (tmeMatch?.[0] ? `https://${tmeMatch[0]}` : '') ||
      (handleMatch?.[1] ? `https://t.me/${handleMatch[1]}` : '');
    if (recovered) {
      (extracted as any).apply_url = recovered;
      console.log(`[Ingest] 🩹 Recovered apply_url for "${extracted.title}": ${recovered}`);
    } else {
      // Should be unreachable given rawHasContact === true, but be safe
      console.log(`[Ingest] 🔗 Skipping "${extracted.title}" — could not extract a contact`);
      return null;
    }
  }

  console.log(`[Ingest] ✅ Accepted: "${extracted.title}"`);

  const supabase = db();

  // ── Step 2: Deduplicate by title (case-insensitive) ─────────────────────────
  const { data: existing, error: dupError } = await supabase
    .from('events')
    .select('id')
    .ilike('title', extracted.title.trim())
    .limit(1);

  if (dupError) throw new Error(`Dup check failed: ${dupError.message}`);

  if (existing && existing.length > 0) {
    console.log(`[Ingest] 🛑 Duplicate: "${extracted.title}"`);
    return null;
  }

  // ── Step 3: Parse deadline ──────────────────────────────────────────────────
  let deadlineIso: string | null = null;
  if (extracted.deadline) {
    const d = new Date(extracted.deadline);
    if (!isNaN(d.getTime())) deadlineIso = d.toISOString();
  }

  // ── Step 4: Embed apply_url in description so enrichment gets it for free ───
  // The URL was extracted from the raw post text (no extra Groq call) and passed
  // through the extraction prompt. Appending it to description ensures the enrich
  // step can use it directly for officialWebsite without any external lookup.
  const applyUrl = (extracted as any).apply_url?.trim() || null;
  const descriptionWithUrl = applyUrl
    ? `${extracted.description}\n\n🔗 ${applyUrl}`
    : extracted.description;

  // ── Step 5: Insert — only confirmed-existing columns ───────────────────────
  const { data: inserted, error: insertError } = await supabase
    .from('events')
    .insert({
      title:       extracted.title,
      description: descriptionWithUrl,
      location:    extracted.location,
      deadline:    deadlineIso,
      language:    extracted.language,
      source:      extracted.category ?? null,  // category pill on homepage
      is_active:   false,                        // enrich cron activates it
      age_min:     extracted.age?.min ?? 0,
      age_max:     extracted.age?.max ?? 100,
      // research_data left NULL → enrich cron picks up WHERE research_data IS NULL
    })
    .select('id')
    .single();

  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

  return inserted?.id ?? null;
}
