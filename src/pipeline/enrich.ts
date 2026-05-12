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

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoResource {
  url:   string;
  title: string;
}

interface ResearchData {
  extendedDescription:   string;
  eligibilityCriteria:   string[];
  keyDetails:            string[];
  competitionTips:       string[];
  officialWebsite:       string | null;
  applyLabel:            string | null;
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

// ── Prompts ───────────────────────────────────────────────────────────────────

function researchPrompt(title: string, description: string): string {
  return `You are a research assistant for Fursatly, an opportunity platform for Uzbek students.

Analyze this opportunity and return ONLY a valid JSON object. No markdown, no explanation.

Title: ${title}
Description: ${description?.slice(0, 2000) ?? 'Not provided'}

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
- eligibilityCriteria: ONLY requirements EXPLICITLY stated in the text. If none stated, return []. NEVER invent.
- keyDetails: must be SUBSTANTIVE facts — a prize amount ("$3,000 prize"), a duration ("12-week summer program"), a stipend ("monthly $800 stipend"), a class size ("400 selected participants"), a specific date range. Each entry must be ≥ 4 words OR contain a number/currency/duration unit. NEVER write vague placeholders like "this week", "next year", "International", "fully-funded", "online" on their own. If the source has no concrete numbers/dates/quantities, return [] — empty is better than fabricated.
- competitionTips: actionable steps a student can take BEFORE applying. Not "work hard". Not "be yourself". Not generic resume advice that applies to every opportunity. Each tip must be at least 6 words AND specific to THIS opportunity's domain. If the source gives you nothing program-specific, return [] — empty is better than filler.
- confidence: 0.0–1.0 based on clarity of source. If source is < 100 chars of real content, max confidence is 0.3.
- officialWebsite: the application/info URL. Check the description first — if it contains a 🔗 line, that IS the URL, copy it exactly. Otherwise use any URL in the description text. If none is present but you recognise the program, provide the correct official URL from your knowledge. Return null only if you genuinely cannot determine it.
- Arrays may be empty [] if there is genuinely nothing to add. EMPTY IS BETTER THAN FABRICATED.`;
}

function translationPrompt(fields: Record<string, unknown>, language: string): string {
  return `Translate to ${language}. Return ONLY the JSON object, no explanation.

${JSON.stringify(fields, null, 2)}

Rules:
- Keep the same JSON keys
- Arrays must stay as arrays of strings
- Translate naturally, not word-for-word
- ${language === 'Uzbek (Latin script)' ? 'Use Latin Uzbek script, not Cyrillic' : 'Use natural Russian'}`;
}

// ── YouTube search ────────────────────────────────────────────────────────────
//
// Flow (no API key needed):
//   1. Groq picks the best search query for this opportunity (~30 tokens)
//   2. We fetch youtube.com/results and parse ytInitialData JSON embedded in the page
//   3. Return the first real video result (silent failure at every step)

function youtubeQueryPrompt(title: string, category: string): string {
  return `A student wants to find a YouTube video to help them prepare for this opportunity:
"${title}" (${category})

Write ONE concise YouTube search query (5-8 words) that would find the most useful
how-to or advice video for applying to this kind of opportunity.
Return ONLY the search query — no quotes, no explanation.`;
}

async function findYouTubeVideo(
  title: string,
  category: string,
): Promise<VideoResource | null> {
  try {
    // Step 1: Groq generates the best search query (short, no reasoning — use 8B)
    const query = (await callLLM(youtubeQueryPrompt(title, category), 40, 'fast')).trim()
      .replace(/^["']|["']$/g, '');   // strip any surrounding quotes

    if (!query) return null;

    // Step 2: Fetch YouTube search results page
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encoded}&hl=en`,
      {
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return null;

    const html = await res.text();

    // Step 3: Parse ytInitialData — YouTube embeds full search results as JSON
    // Use indexOf instead of dotAll regex (ES2017 compat — no /s flag)
    const marker = 'var ytInitialData = ';
    const start  = html.indexOf(marker);
    if (start === -1) return null;
    const jsonStart = start + marker.length;
    const scriptEnd = html.indexOf(';</script>', jsonStart);
    const match     = scriptEnd > jsonStart ? [null, html.slice(jsonStart, scriptEnd)] : null;
    if (!match) return null;

    const data      = JSON.parse(match[1] as string);
    const contents  =
      data?.contents?.twoColumnSearchResultsRenderer
           ?.primaryContents?.sectionListRenderer
           ?.contents?.[0]?.itemSectionRenderer?.contents as any[] | undefined;

    if (!Array.isArray(contents)) return null;

    for (const item of contents) {
      const v = item?.videoRenderer;
      if (v?.videoId && v?.title?.runs?.[0]?.text) {
        return {
          url:   `https://www.youtube.com/watch?v=${v.videoId}`,
          title: v.title.runs[0].text as string,
        };
      }
    }

    return null;
  } catch {
    // Any failure (network, parse, Groq) → skip YouTube silently
    return null;
  }
}

// ── Funding detection ─────────────────────────────────────────────────────────

function detectFunding(research: ResearchData): string | null {
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

// ── Quality gate ──────────────────────────────────────────────────────────────

function qualityGate(
  event:    { title: string; deadline: string | null },
  _research: ResearchData,
): { pass: boolean; reason: string } {
  if (!event.title || event.title.trim().length < 8) {
    return { pass: false, reason: `Title too short: "${event.title}"` };
  }
  if (event.deadline) {
    const dl = new Date(event.deadline);
    if (!isNaN(dl.getTime()) && dl < new Date()) {
      return { pass: false, reason: `Deadline passed: ${event.deadline}` };
    }
  }
  return { pass: true, reason: '' };
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
  // Uses 'smart' tier (70B) — needs knowledge recall, structured JSON, nuance
  const raw      = await callLLM(researchPrompt(event.title, event.description ?? ''), 900, 'smart');
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

  // Translation is shape-preserving, no reasoning — use 'fast' tier (8B).
  // 8B model has ~140× the daily token quota of 70B, so translations don't
  // eat into the research budget. Falls back to 70B via OpenRouter if needed.
  let uzTranslation: UzTranslation | undefined;
  try {
    const uzRaw = await callLLM(translationPrompt(fieldsToTranslate, 'Uzbek (Latin script)'), 700, 'fast');
    uzTranslation = parseJSON<UzTranslation>(uzRaw);
  } catch {
    // Translation failed — continue with English only
  }

  // ── Step 2b: Translate to Russian (silent failure) ─────────────────────────
  let ruTranslation: RuTranslation | undefined;
  try {
    const ruRaw = await callLLM(translationPrompt(fieldsToTranslate, 'Russian'), 700, 'fast');
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

  // ── Step 5: YouTube preparation video (silent failure) ────────────────────
  // Re-use any video that was already found (don't re-fetch on re-enrichment)
  if (existing.preparationResources?.length) {
    research.preparationResources = existing.preparationResources;
  } else {
    const category = (event as any).source ?? 'Opportunity';
    const video = await findYouTubeVideo(event.title, category);
    if (video) {
      research.preparationResources = [video];
      console.log(`[Enrich] YouTube: "${video.title}" for "${event.title}"`);
    }
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
