/**
 * Fursatly — Event Enrichment Pipeline
 *
 * Works with the CURRENT database schema — no migration required.
 * Uses only confirmed-existing columns: id, title, description, deadline,
 * is_active, research_data.
 *
 * Steps:
 *   1. Research  — Groq extracts eligibility, tips, key facts
 *   2. Translate — Groq translates to Uzbek (silent failure)
 *   3. Detect funding — stored inside research_data.funding_type
 *   4. Quality gate — title length + deadline not past
 *   5. YouTube   — Groq picks search query → scrape first result → validate (silent failure)
 *   6. Activate  — is_active=true, research_data saved
 *
 * Throws on research failure → caller records the attempt count.
 */

import { createClient } from '@supabase/supabase-js';
import { callLLM, parseJSON } from './groq';
// Plain-ESM helper shared with the local backfill script (typed via its JSDoc).
import { resolveApplyLink } from './resolve-link.mjs';
import { researchPrompt, translationPrompt } from './prompts.mjs';
import { findYouTubeVideos } from './youtube.mjs';
import { detectFunding, qualityGate } from './quality.mjs';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoResource {
  url:      string;
  title:    string;
  channel?: string | null;
  type?:    string;
}

interface ResearchData {
  is_opportunity:        boolean;
  extendedDescription:   string;
  eligibilityCriteria:   string[];
  keyDetails:            string[];
  competitionTips:       string[];
  officialWebsite:       string | null;
  applyLabel:            string | null;
  linkStatus?:           string;        // 'ok' | 'unverified' | 'dead' | 'contact' | 'none'
  linkResolvedFrom?:     string | null; // aggregator URL we de-aggregated away from
  linkCheckedAt?:        string;
  confidence:            number;
  funding_type:          string | null;
  translations?:         { uz?: UzTranslation; ru?: RuTranslation };
  preparationResources?: VideoResource[];
  lastEnrichedAt:        string;
}

interface UzTranslation {
  title:               string;
  extendedDescription: string;
  eligibilityCriteria: string[];
  keyDetails:          string[];
  competitionTips:     string[];
}

interface RuTranslation {
  title:               string;
  extendedDescription: string;
  eligibilityCriteria: string[];
  keyDetails:          string[];
  competitionTips:     string[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function enrichEvent(eventId: string): Promise<void> {
  const supabase = db();

  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('id, title, description, deadline, source, research_data')
    .eq('id', eventId)
    .single();

  if (fetchErr || !event) throw new Error(`Event ${eventId} not found`);

  const existing = (event.research_data ?? {}) as Partial<ResearchData>;

  // ── Step 1: Research (throws on failure → caller handles retry) ────────────
  const raw      = await callLLM(researchPrompt(event.title, event.description ?? ''), 900);
  const research = parseJSON<ResearchData>(raw);

  research.confidence     = Math.max(0, Math.min(1, Number(research.confidence) || 0.5));
  research.lastEnrichedAt = new Date().toISOString();

  // ── Step 2: Translate to Uzbek (silent failure) ────────────────────────────
  const fieldsToTranslate = {
    title:               event.title,
    extendedDescription: research.extendedDescription,
    eligibilityCriteria: research.eligibilityCriteria,
    keyDetails:          research.keyDetails,
    competitionTips:     research.competitionTips,
  };

  let uzTranslation: UzTranslation | undefined;
  try {
    const uzRaw = await callLLM(translationPrompt(fieldsToTranslate, 'Uzbek (Latin script)'), 700);
    uzTranslation = parseJSON<UzTranslation>(uzRaw);
  } catch {
    // Translation failed — continue with English only
  }

  // ── Step 2b: Translate to Russian (silent failure) ─────────────────────────
  let ruTranslation: RuTranslation | undefined;
  try {
    const ruRaw = await callLLM(translationPrompt(fieldsToTranslate, 'Russian'), 700);
    ruTranslation = parseJSON<RuTranslation>(ruRaw);
  } catch {
    // Translation failed — continue without Russian
  }

  research.translations = { uz: uzTranslation, ru: ruTranslation };

  // ── Step 3: Detect funding (stored inside research_data) ───────────────────
  research.funding_type = detectFunding(research);

  // ── Step 4: Quality gate ───────────────────────────────────────────────────
  const { pass, reason } = qualityGate(event, research);

  if (!pass) {
    await supabase
      .from('events')
      .update({ research_data: { ...research, _skipped: true, _skipReason: reason } })
      .eq('id', eventId);
    console.log(`[Enrich] Skipped "${event.title}": ${reason}`);
    return;
  }

  // ── Step 5: YouTube preparation videos (silent failure) ────────────────────
  // Re-use any videos already found (don't re-fetch on re-enrichment).
  if (existing.preparationResources?.length) {
    research.preparationResources = existing.preparationResources;
  } else {
    const category = (event as any).source ?? 'Opportunity';
    const videos = await findYouTubeVideos(callLLM, { title: event.title, category, description: research.extendedDescription ?? '' });
    if (videos.length) {
      research.preparationResources = videos;
      console.log(`[Enrich] YouTube: ${videos.length} videos for "${event.title}"`);
    }
  }

  // ── Step 5b: Resolve + validate the apply link (silent failure) ────────────
  // De-aggregate reposter links (edugrants.uz / grantlar.uz → real program page)
  // and confirm the final URL resolves. Never blocks activation — a bad link is
  // an enhancement failure, so we keep the best available and record its status.
  try {
    const resolved = await resolveApplyLink(research.officialWebsite, {
      title:   event.title,
      callLLM,
    });
    research.officialWebsite  = resolved.url;
    research.linkStatus       = resolved.status;
    research.linkResolvedFrom = resolved.resolvedFrom;
    research.linkCheckedAt    = new Date().toISOString();
    if (resolved.resolvedFrom) {
      console.log(`[Enrich] 🔀 De-aggregated link for "${event.title}": ${resolved.resolvedFrom} → ${resolved.url}`);
    }
  } catch {
    // resolveApplyLink never throws, but guard anyway — links are optional.
  }

  // ── Step 6: Activate ───────────────────────────────────────────────────────
  await supabase
    .from('events')
    .update({
      is_active:     true,
      research_data: research,
    })
    .eq('id', eventId);
}
