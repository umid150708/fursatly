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

interface VideoCandidate {
  videoId: string;
  title:   string;
  channel: string | null;
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

// ── Prompts ───────────────────────────────────────────────────────────────────

function researchPrompt(title: string, description: string): string {
  return `You are a research assistant for Fursatly, an opportunity platform for Uzbek students.

Analyze this opportunity and return ONLY a valid JSON object. No markdown, no explanation.

Title: ${title}
Description: ${description?.slice(0, 2000) ?? 'Not provided'}

Return this exact shape:
{
  "is_opportunity": true,
  "extendedDescription": "2-3 sentences: what this opportunity is, who benefits, why it matters",
  "eligibilityCriteria": ["requirement 1", "requirement 2"],
  "keyDetails": ["concrete fact 1 (prize/duration/benefit)", "fact 2"],
  "competitionTips": ["actionable tip a student can do today", "tip 2"],
  "officialWebsite": "https://... or null",
  "applyLabel": "Apply on official website",
  "confidence": 0.85
}

Rules:
- is_opportunity: true ONLY if this is something a student actively applies to and receives a direct personal benefit from — scholarship, grant, internship, fellowship, exchange programme, competition with a prize, research programme, fully-funded trip. Set to false for: awards ceremonies where others nominate or vote for you, pure spectator events, info sessions, conferences without funding, nomination-only events, honorary recognitions. When in doubt, set false.
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
// Multi-query flow (no API key needed):
//   1. Groq returns TWO complementary search queries grounded in the opportunity's
//      description (one Groq call → a JSON array of two strings)
//   2. Fetch both youtube.com/results pages, parse the embedded ytInitialData JSON
//   3. Filter out Shorts / live / off-length clips, dedupe by video + channel
//   4. Interleave the two lists so both angles show up, keep up to `max` (3)
//
// Silent failure at every step — videos are an optional enhancement, never a blocker.

const MIN_DURATION_SEC = 90;    // drop Shorts / trailers (< 1.5 min)
const MAX_DURATION_SEC = 2700;  // drop lectures / streams (> 45 min)

function youtubeQueriesPrompt(title: string, category: string, description: string): string {
  return `A student found this opportunity and wants YouTube videos to help them prepare for it and apply.

Title: ${title}
Category: ${category}
About: ${(description ?? '').slice(0, 400) || 'Not provided'}

Write TWO different, complementary English YouTube search queries (each 4-8 words) that would surface the most useful videos for THIS specific opportunity. Target different angles — e.g. one about the application / eligibility / how-to, and one about preparation (portfolio, essay, interview, or the subject-specific skills this opportunity needs).

Base the queries on what this opportunity ACTUALLY is. Do NOT assume it is undergraduate university admissions unless the text clearly says so — a fellowship, grant, competition, or internship needs different videos than "how to get into college".

Return ONLY a JSON array of exactly two strings, e.g. ["query one", "query two"]. No explanation, no markdown.`;
}

function parseQueries(raw: string): string[] {
  const cleaned = String(raw ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string');
  } catch { /* fall through */ }
  const m = cleaned.match(/\[[\s\S]*?\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string');
    } catch { /* fall through */ }
  }
  return cleaned
    .split('\n')
    .map(l => l.replace(/^[\s\-*\d.)]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
    .slice(0, 2);
}

function extractYtInitialData(html: string): any {
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const start = html.indexOf(marker);
    if (start === -1) continue;
    const jsonStart = start + marker.length;
    const end = html.indexOf(';</script>', jsonStart);
    if (end > jsonStart) {
      try { return JSON.parse(html.slice(jsonStart, end)); } catch { /* try next marker */ }
    }
  }
  return null;
}

function parseDurationToSeconds(s: string | undefined): number | null {
  if (!s) return null;
  const parts = String(s).split(':').map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function toCandidate(v: any): VideoCandidate | null {
  const videoId = v?.videoId;
  const title   = v?.title?.runs?.[0]?.text;
  if (!videoId || !title) return null;

  const durationSec = parseDurationToSeconds(v?.lengthText?.simpleText);
  if (durationSec == null) return null;                              // live / upcoming
  if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) return null;

  const channel =
    v?.ownerText?.runs?.[0]?.text ||
    v?.longBylineText?.runs?.[0]?.text ||
    null;

  return { videoId, title, channel };
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// One fetch attempt. Returns null when the page had no parseable results —
// YouTube intermittently serves a throttle/consent/alternate page with no
// ytInitialData. null = retryable; [] = genuinely empty.
async function fetchCandidatesOnce(query: string): Promise<VideoCandidate[] | null> {
  const res = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`,
    {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return null;
  const data = extractYtInitialData(await res.text());
  if (!data) return null;

  const sections =
    data?.contents?.twoColumnSearchResultsRenderer
         ?.primaryContents?.sectionListRenderer?.contents as any[] | undefined;
  if (!Array.isArray(sections)) return [];

  const out: VideoCandidate[] = [];
  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents as any[] | undefined;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item?.videoRenderer) continue;
      const c = toCandidate(item.videoRenderer);
      if (c) out.push(c);
    }
  }
  return out;
}

async function fetchCandidates(query: string): Promise<VideoCandidate[]> {
  try {
    let r = await fetchCandidatesOnce(query);
    if (r === null) {                     // transient miss — back off briefly, retry once
      await sleep(1200);
      r = await fetchCandidatesOnce(query);
    }
    return r ?? [];
  } catch {
    return [];
  }
}

function interleave(lists: VideoCandidate[][], max: number): VideoResource[] {
  const picked: VideoResource[] = [];
  const seenVideo   = new Set<string>();
  const seenChannel = new Set<string>();
  const maxLen = Math.max(0, ...lists.map(l => l.length));

  const take = (v: VideoCandidate | undefined, enforceChannel: boolean) => {
    if (picked.length >= max || !v || seenVideo.has(v.videoId)) return;
    const chKey = v.channel ? v.channel.toLowerCase() : null;
    if (enforceChannel && chKey && seenChannel.has(chKey)) return;
    seenVideo.add(v.videoId);
    if (chKey) seenChannel.add(chKey);
    picked.push({
      url:     `https://www.youtube.com/watch?v=${v.videoId}`,
      title:   v.title,
      channel: v.channel || null,
      type:    'Video',
    });
  };

  for (let i = 0; i < maxLen && picked.length < max; i++) {
    for (const list of lists) take(list[i], true);
  }
  for (let i = 0; i < maxLen && picked.length < max; i++) {
    for (const list of lists) take(list[i], false);
  }

  return picked;
}

async function findYouTubeVideos(
  title: string,
  category: string,
  description: string,
  max = 3,
): Promise<VideoResource[]> {
  try {
    const raw = await callLLM(youtubeQueriesPrompt(title, category, description), 100);
    const queries = parseQueries(raw)
      .map(q => q.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
      .slice(0, 2);

    if (!queries.length) return [];

    // Fetch both query pages together (each with its own retry-on-empty).
    const lists = await Promise.all(queries.map(q => fetchCandidates(q)));

    return interleave(lists, max);
  } catch {
    // Any failure (network, parse, Groq) → skip videos silently
    return [];
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
  research: ResearchData,
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
  if (research.is_opportunity === false) {
    return { pass: false, reason: `Not a genuine opportunity (awards ceremony / passive event): "${event.title}"` };
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
    const videos = await findYouTubeVideos(event.title, category, research.extendedDescription ?? '');
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
