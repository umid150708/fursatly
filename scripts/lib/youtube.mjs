/**
 * Fursatly — YouTube preparation-video finder (shared, no API key needed).
 *
 * Multi-query strategy: ask Groq for TWO complementary search angles grounded
 * in the opportunity's real description, fetch both YouTube results pages,
 * filter out Shorts / live / off-length videos, dedupe by video + channel,
 * then interleave the two result lists so both angles are represented.
 *
 * Returns up to `max` (default 3) videos: [{ url, title, channel, type }].
 * Silent failure at every step — videos are an optional enhancement.
 *
 * Used by both the live pipeline (ported to TS in src/pipeline/enrich.ts),
 * bulk-enrich.mjs, and backfill-videos.mjs.
 */

// ── Query generation ────────────────────────────────────────────────────────
//
// ONE Groq call returns two queries (a JSON array). Grounding the prompt in the
// opportunity's description is what stops the "Princeton admissions essay" video
// showing up on a professional arts fellowship — the model needs to know what
// the opportunity actually IS before it can search for it.

function queriesPrompt(title, category, description) {
  return `A student found this opportunity and wants YouTube videos to help them prepare for it and apply.

Title: ${title}
Category: ${category}
About: ${(description ?? '').slice(0, 400) || 'Not provided'}

Write TWO different, complementary English YouTube search queries (each 4-8 words) that would surface the most useful videos for THIS specific opportunity. Target different angles — e.g. one about the application / eligibility / how-to, and one about preparation (portfolio, essay, interview, or the subject-specific skills this opportunity needs).

Base the queries on what this opportunity ACTUALLY is. Do NOT assume it is undergraduate university admissions unless the text clearly says so — a fellowship, grant, competition, or internship needs different videos than "how to get into college".

Return ONLY a JSON array of exactly two strings, e.g. ["query one", "query two"]. No explanation, no markdown.`;
}

function parseQueries(raw) {
  const cleaned = String(raw ?? '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Preferred: a clean JSON array
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return arr.filter(x => typeof x === 'string');
  } catch { /* fall through */ }

  // Extract the first [...] block from prose
  const m = cleaned.match(/\[[\s\S]*?\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.filter(x => typeof x === 'string');
    } catch { /* fall through */ }
  }

  // Last resort: treat non-empty lines as queries
  return cleaned
    .split('\n')
    .map(l => l.replace(/^[\s\-*\d.)]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
    .slice(0, 2);
}

// ── ytInitialData extraction ────────────────────────────────────────────────
//
// YouTube embeds the full search results as a JSON blob assigned to
// `var ytInitialData = {...};</script>`. indexOf slicing is more robust than a
// non-greedy regex against a multi-megabyte page and needs no /s flag.

function extractYtInitialData(html) {
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

// Walk every result section (not just contents[0]) and pull the videoRenderers.
function collectVideoRenderers(data) {
  const sections = data?.contents?.twoColumnSearchResultsRenderer
    ?.primaryContents?.sectionListRenderer?.contents;
  if (!Array.isArray(sections)) return [];

  const out = [];
  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      // Only plain videos — skip reelShelfRenderer (Shorts), playlists, ads, channels.
      if (item?.videoRenderer) out.push(item.videoRenderer);
    }
  }
  return out;
}

// ── Filtering ───────────────────────────────────────────────────────────────

function parseDurationToSeconds(s) {
  if (!s) return null;                          // live / upcoming have no lengthText
  const parts = String(s).split(':').map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

const MIN_DURATION_SEC = 90;    // drop Shorts / trailers (< 1.5 min)
const MAX_DURATION_SEC = 2700;  // drop lectures / streams (> 45 min)

function toCandidate(v) {
  const videoId = v?.videoId;
  const title = v?.title?.runs?.[0]?.text;
  if (!videoId || !title) return null;

  const durationSec = parseDurationToSeconds(v?.lengthText?.simpleText);
  if (durationSec == null) return null;                             // live / upcoming
  if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) return null;

  const channel =
    v?.ownerText?.runs?.[0]?.text ||
    v?.longBylineText?.runs?.[0]?.text ||
    null;

  return { videoId, title, channel };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// One fetch attempt. Returns null (not []) when the page came back without
// parseable results — YouTube intermittently serves a throttle/consent/alternate
// page with no ytInitialData. null means "retryable"; [] means "genuinely empty".
async function fetchCandidatesOnce(query) {
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
  return collectVideoRenderers(data).map(toCandidate).filter(Boolean);
}

async function fetchCandidates(query) {
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

// ── Interleave + dedupe ─────────────────────────────────────────────────────
//
// Round-robin across the query lists so both search angles are represented.
// Pass 1 enforces one-video-per-channel for diversity; pass 2 relaxes that only
// if we still need to reach `max` (better to fill 3 slots than leave gaps).

function interleave(lists, max) {
  const picked = [];
  const seenVideo = new Set();
  const seenChannel = new Set();
  const maxLen = Math.max(0, ...lists.map(l => l.length));

  const take = (v, enforceChannel) => {
    if (picked.length >= max) return;
    if (!v || seenVideo.has(v.videoId)) return;
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

  // Pass 1 — diverse channels
  for (let i = 0; i < maxLen && picked.length < max; i++) {
    for (const list of lists) take(list[i], true);
  }
  // Pass 2 — fill remaining slots even if same channel
  for (let i = 0; i < maxLen && picked.length < max; i++) {
    for (const list of lists) take(list[i], false);
  }

  return picked;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * @param {(prompt: string, maxTokens?: number) => Promise<string>} callGroq
 * @param {{ title: string, category?: string, description?: string, max?: number }} opts
 * @returns {Promise<Array<{ url: string, title: string, channel: string|null, type: 'Video' }>>}
 */
export async function findYouTubeVideos(callGroq, { title, category = 'Opportunity', description = '', max = 3 }) {
  try {
    const raw = await callGroq(queriesPrompt(title, category, description), 100);
    const queries = parseQueries(raw)
      .map(q => q.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
      .slice(0, 2);

    if (!queries.length) return [];

    // Fetch both query pages together (each with its own retry-on-empty).
    const lists = await Promise.all(queries.map(q => fetchCandidates(q)));

    return interleave(lists, max);
  } catch {
    return [];   // videos are optional — never block enrichment
  }
}
