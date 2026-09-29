/**
 * Fursatly — duplicate detection for scraped listings, in ONE place.
 *
 * The same opportunity is often posted by several channels with small
 * differences: a curly vs straight apostrophe ("'26" / "‘26"), an added edition
 * year ("… Contest 2026"), or a subtitle ("… oromgohi '26 (AYFN Travel
 * Scholarship)"). An exact title match let all of those through.
 *
 * Shared by the ingestion service (src/services/event-ingestion.ts) and the
 * local scripts, like quality.mjs. Pure functions, no imports — identical under
 * Next's bundler and bare `node`.
 */

const DAY = 86_400_000;

/** How far apart two deadlines may be and still describe the same listing. */
const SUBTITLE_WINDOW_DAYS = 3;
/** Beyond this, identically named listings are different editions. */
const EDITION_GAP_DAYS = 60;
/** A shorter title must carry this many words before a subtitle match counts. */
const MIN_CORE_WORDS = 3;

/**
 * A comparable form of a title: lower case, edition years removed, apostrophes
 * of every kind dropped, and anything that is not a letter or digit turned into
 * a single space.
 */
export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/['’‘ʻʼ`´]\d{2}\b/g, ' ')                  // '26  ‘26
    .replace(/\b(?:19|20)\d{2}(?:[/-]\d{2,4})?\b/g, ' ') // 2026  2026/27  2026-2027
    .replace(/['’‘ʻʼ`´]/g, '')                          // o‘zbek → ozbek, either spelling
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole days between two deadlines, or null when either is missing. */
function daysApart(a, b) {
  if (!a || !b) return null;
  const day = (iso) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  const da = day(a);
  const db = day(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(da - db) / DAY;
}

/**
 * The existing listing that `candidate` duplicates, or null.
 *
 * - Same normalized title: a duplicate, unless both deadlines are known and
 *   months apart (then they are different editions of one programme).
 * - One title is the other plus extra words (a subtitle), the shorter carries at
 *   least three words, and the deadlines are both missing or within three days.
 *
 * @param {{ title: string, deadline?: string | null }} candidate
 * @param {Array<{ id: string, title: string, deadline?: string | null }>} existing
 */
export function findDuplicate(candidate, existing) {
  const n = normalizeTitle(candidate.title);
  if (!n) return null;

  for (const e of existing) {
    if (normalizeTitle(e.title) !== n) continue;
    const gap = daysApart(candidate.deadline, e.deadline);
    if (gap === null || gap <= EDITION_GAP_DAYS) return e;
  }

  for (const e of existing) {
    const m = normalizeTitle(e.title);
    if (!m || m === n) continue;
    const [shorter, longer] = m.length < n.length ? [m, n] : [n, m];
    if (shorter.split(' ').length < MIN_CORE_WORDS) continue;
    if (!` ${longer} `.includes(` ${shorter} `)) continue;
    const gap = daysApart(candidate.deadline, e.deadline);
    const bothOpen = !candidate.deadline && !e.deadline;
    if (bothOpen || (gap !== null && gap <= SUBTITLE_WINDOW_DAYS)) return e;
  }

  return null;
}
