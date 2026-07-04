/**
 * Apply-link resolver — shared by the serverless enrich pipeline (enrich.ts)
 * and the local backfill script (scripts/fix-apply-links.mjs).
 *
 * Two jobs:
 *   1. De-aggregate — some posts link to Uzbek reposter sites (edugrants.uz,
 *      grantlar.uz) instead of the real program page. Those aggregator pages
 *      embed the true official link; we fetch the page and recover it.
 *   2. Validate — confirm the final URL actually resolves (not dead / 404).
 *
 * Pure ESM, no node-only or app-only imports: the one environment-specific
 * dependency (the LLM tie-break) is INJECTED as `callLLM`, so this single file
 * runs unchanged in both the serverless bundle and a plain `node` script.
 *
 * Never throws — a bad link is an enhancement failure, never a blocker. Returns
 * the best URL we can stand behind plus a status the caller stores for auditing.
 */

// Known reposter/aggregator hosts: the apply link points here, but the real
// program lives elsewhere. Keep this list tight — only true reposters, not
// legitimate Uzbek program sites (e.g. jdu.uz runs its own programs).
const AGGREGATOR_HOSTS = new Set(['edugrants.uz', 'grantlar.uz']);

// Domains that are never the official application link: socials, trackers,
// CDNs, and HTML boilerplate. Matched against the candidate's hostname.
const NOISE_HOST = /(?:^|\.)(?:facebook|instagram|twitter|x|t|telegram|youtube|youtu|linkedin|tiktok|wa|whatsapp|pinterest)\.(?:com|be|me)$|google|gstatic|googleapis|doubleclick|gtag|cloudflare|jsdelivr|unpkg|gravatar|wp\.com|w\.org|gmpg\.org|schema\.org|fonts\.|cdn/i;

// Asset/feed URLs that slip through as anchors.
const NOISE_PATH = /\.(?:css|js|png|jpe?g|svg|gif|ico|webp|pdf|zip|xml)(?:$|\?)|\/(?:wp-json|xmlrpc|feed)\b/i;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
}

// Drop marketing/tracking query params (utm_*, fbclid, gclid, …) while keeping
// functional ones a page actually needs (e.g. DAAD's ?detail=<id>).
function stripTracking(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(k) || /^(?:fbclid|gclid|mc_cid|mc_eid|igshid|ref|ref_src|source)$/i.test(k)) {
        u.searchParams.delete(k);
      }
    }
    u.hash = '';
    return u.toString();
  } catch { return url; }
}

export function isAggregator(url) {
  const h = hostOf(url);
  return h != null && AGGREGATOR_HOSTS.has(h);
}

/**
 * Pull outbound links from an aggregator page and group them by host, discarding
 * the aggregator's own host and all noise. Returns [{ host, url, count }] sorted
 * by how many distinct URLs each host got — the real program link is repeated
 * (header, apply button, "visit site"); ad/boilerplate links appear once.
 */
export function extractCandidates(html, pageUrl) {
  const ownHost = hostOf(pageUrl);
  const byHost = new Map(); // host → Set<url>

  const re = /href=["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = stripTracking(m[1].replace(/&amp;/g, '&').trim());
    const host = hostOf(raw);
    if (!host) continue;
    if (host === ownHost) continue;               // the aggregator itself
    if (NOISE_HOST.test(host)) continue;          // socials / trackers / CDNs
    if (NOISE_PATH.test(raw)) continue;           // asset / feed URLs
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(raw);
  }

  return [...byHost.entries()]
    .map(([host, urls]) => ({
      host,
      // canonical URL for the host: the shortest path (usually the homepage /
      // main program page rather than a deep sub-link).
      url: [...urls].sort((a, b) => a.length - b.length)[0],
      count: urls.size,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Choose the official link from the candidates.
 *   • 0 candidates → null (keep the aggregator link upstream)
 *   • 1 candidate, or a clear frequency winner → take it, no LLM
 *   • a tie for the top spot → one LLM call to disambiguate (if provided)
 */
export async function pickOfficial(candidates, title, callLLM) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].url;

  const [top, second] = candidates;
  if (top.count > second.count) return top.url; // clear winner by frequency

  // Frequency tie → ask the model which host is THIS opportunity's official site.
  if (typeof callLLM === 'function') {
    try {
      const list = candidates.slice(0, 8).map((c, i) => `${i + 1}. ${c.url}`).join('\n');
      const prompt =
        `An opportunity titled "${title}" was reposted on an aggregator site. ` +
        `Below are the external links found on that repost. Return ONLY the number ` +
        `of the one that is the OFFICIAL program / application website (the organiser's ` +
        `own site), or 0 if none of them is.\n\n${list}\n\nAnswer with a single number.`;
      const raw = await callLLM(prompt, 8);
      const pick = parseInt(String(raw).match(/\d+/)?.[0] ?? '0', 10);
      if (pick >= 1 && pick <= candidates.length) return candidates[pick - 1].url;
    } catch { /* fall through to frequency default */ }
  }

  return top.url; // default: most-linked host
}

/** GET the URL (following redirects) and report whether it resolves. */
export async function checkReachable(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(12_000),
    });
    // 2xx/3xx = reachable. Many sites 403/405 a bare bot GET while being perfectly
    // live in a browser, so treat those as "unverified", not "dead".
    if (res.ok) return 'ok';
    if (res.status === 403 || res.status === 405 || res.status === 429) return 'unverified';
    return 'dead';
  } catch {
    return 'unverified'; // network hiccup / timeout — don't punish a maybe-live link
  }
}

async function deAggregate(pageUrl, title, callLLM) {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const candidates = extractCandidates(await res.text(), pageUrl);
    return await pickOfficial(candidates, title, callLLM);
  } catch {
    return null;
  }
}

/**
 * Resolve a stored apply URL to the best link we can stand behind.
 *
 * @param {string|null|undefined} url   the current apply/official URL
 * @param {{ title?: string, callLLM?: (p: string, t?: number) => Promise<string> }} opts
 * @returns {Promise<{ url: string|null, status: string, resolvedFrom: string|null }>}
 *   status: 'none' | 'contact' | 'ok' | 'unverified' | 'dead'
 *   resolvedFrom: the aggregator URL we de-aggregated away from, else null
 */
export async function resolveApplyLink(url, { title = '', callLLM } = {}) {
  const clean = (url ?? '').trim();
  if (!clean) return { url: null, status: 'none', resolvedFrom: null };

  // Intentional contact paths (email / Telegram) — leave as-is, don't validate.
  if (/^mailto:/i.test(clean) || /^(?:https?:\/\/)?t\.me\//i.test(clean)) {
    return { url: clean, status: 'contact', resolvedFrom: null };
  }

  let current = clean;
  let resolvedFrom = null;

  if (isAggregator(current)) {
    const official = await deAggregate(current, title, callLLM);
    if (official) {
      resolvedFrom = current;
      current = official;
    }
  }

  const status = await checkReachable(current);
  return { url: current, status, resolvedFrom };
}
