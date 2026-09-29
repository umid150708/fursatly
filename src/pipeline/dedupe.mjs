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

/** Words that carry no identity: "OECD Internship Programme" is "OECD Internship". */
const FILLER = /\b(?:programme|program)s?\b/g;
/** Short words that join a name together without being part of it. */
const STOPWORDS = new Set([
  'the', 'of', 'at', 'in', 'for', 'and', 'a', 'an', 'to', 'on', 'by', 'with', 'from',
  'uchun', 'va', 'boyicha', 'bilan',
]);
/** Words many unrelated listings share, so sharing one proves nothing. */
const GENERIC = new Set([
  'scholarship', 'scholarships', 'grant', 'grants', 'internship', 'internships', 'fellowship',
  'fellowships', 'summer', 'winter', 'school', 'university', 'college', 'colleges', 'international',
  'research', 'student', 'students', 'competition', 'contest', 'award', 'prize', 'olympiad', 'camp',
  'exchange', 'study', 'online', 'global', 'youth', 'young', 'summit', 'conference', 'course',
  'diploma', 'degree', 'bachelor', 'master', 'masters', 'phd', 'full', 'fully', 'funded',
  'undergraduate', 'graduate', 'postgraduate', 'programmes', 'opportunity', 'application',
  'tanlov', 'tanlovi', 'stipendiya', 'stipendiyasi', 'dasturi', 'loyihasi', 'yozgi',
  'maktab', 'maktabi', 'xalqaro', 'universiteti', 'oromgohi',
]);

/**
 * A comparable form of a title: lower case, edition years removed, "programme"
 * and "program" dropped, apostrophes of every kind dropped, and anything that is
 * not a letter or digit turned into a single space.
 */
export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/['’‘ʻʼ`´]\d{2}\b/g, ' ')                  // '26  ‘26
    .replace(/\b(?:19|20)\d{2}(?:[/-]\d{2,4})?\b/g, ' ') // 2026  2026/27  2026-2027
    .replace(/['’‘ʻʼ`´]/g, '')                          // o‘zbek → ozbek, either spelling
    .replace(FILLER, ' ')
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

/** The words of a normalized title that identify it. */
function contentWords(normalized) {
  return normalized.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * A link's identity: host (no www) and path (no trailing slash, query or
 * fragment), or null when it names no specific page. A bare domain is not
 * specific, and neither is a Telegram channel: only one of its posts is.
 */
export function linkKey(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const segments = u.pathname.split('/').filter(Boolean);
  const telegram = host === 't.me' || host === 'telegram.me';
  if (segments.length < (telegram ? 2 : 1)) return null;
  return `${host}/${segments.join('/')}`.toLowerCase();
}

/**
 * The existing listing that `candidate` duplicates, or null.
 *
 * - Same normalized title: a duplicate, unless both deadlines are known and
 *   months apart (then they are different editions of one programme).
 * - Both posts link to the same specific page or Telegram post, and the
 *   deadlines are not months apart.
 * - One title is the other plus extra words (a subtitle), the shorter carries at
 *   least three words, and the deadlines are both missing or within three days.
 * - Every word of the shorter title (at least three) appears in the longer one,
 *   and the deadlines agree within three days or one of them is missing.
 *
 * `urls` are the links the post itself carried, never the website enrichment
 * looked up: that guess can be a shared contact page.
 *
 * @param {{ title: string, deadline?: string | null, urls?: string[] }} candidate
 * @param {Array<{ id: string, title: string, deadline?: string | null, urls?: string[] }>} existing
 */
export function findDuplicate(candidate, existing) {
  const n = normalizeTitle(candidate.title);
  if (!n) return null;

  for (const e of existing) {
    if (normalizeTitle(e.title) !== n) continue;
    const gap = daysApart(candidate.deadline, e.deadline);
    if (gap === null || gap <= EDITION_GAP_DAYS) return e;
  }

  const links = new Set((candidate.urls ?? []).map(linkKey).filter(Boolean));
  if (links.size) {
    for (const e of existing) {
      if (!(e.urls ?? []).some((u) => links.has(linkKey(u)))) continue;
      const gap = daysApart(candidate.deadline, e.deadline);
      if (gap === null || gap <= EDITION_GAP_DAYS) return e;
    }
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

  const words = new Set(contentWords(n));
  for (const e of existing) {
    const other = new Set(contentWords(normalizeTitle(e.title)));
    const [shorter, longer] = words.size <= other.size ? [words, other] : [other, words];
    if (shorter.size < MIN_CORE_WORDS || shorter.size === longer.size) continue;
    if (![...shorter].every((w) => longer.has(w))) continue;
    const gap = daysApart(candidate.deadline, e.deadline);
    if (gap === null || gap <= SUBTITLE_WINDOW_DAYS) return e;
  }

  return null;
}

/**
 * Listings that may be `candidate` under another name, for a model to confirm:
 * the same deadline day and a distinctive shared word ("United World Colleges
 * (UWC)" and "UWC International Baccalaureate…", reposted via grantlar.uz).
 * Never decides on its own: two contests from one organiser can close the same
 * day ("Writers of the Future", "The Illustrators Of The Future").
 *
 * @param {{ title: string, deadline?: string | null, urls?: string[] }} candidate
 * @param {Array<{ id: string, title: string, deadline?: string | null, urls?: string[] }>} existing
 * @param {number} [limit]
 */
export function suspectDuplicates(candidate, existing, limit = 3) {
  if (!candidate.deadline) return [];
  const words = new Set(contentWords(normalizeTitle(candidate.title)).filter((w) => !GENERIC.has(w)));
  const out = [];
  for (const e of existing) {
    if (daysApart(candidate.deadline, e.deadline) !== 0) continue;
    const shared = contentWords(normalizeTitle(e.title)).filter((w) => words.has(w)).length;
    if (shared >= 1) out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The yes/no question put to the model for one suspected pair.
 * @param {{ title: string, deadline?: string | null, description?: string | null }} a
 * @param {{ title: string, deadline?: string | null, description?: string | null }} b
 */
export function sameListingPrompt(a, b) {
  const show = (x) =>
    `${x.title} (deadline ${x.deadline ? String(x.deadline).slice(0, 10) : 'none'})\n` +
    String(x.description ?? '').replace(/\s+/g, ' ').slice(0, 300);
  return (
    'Two opportunity listings were posted by Telegram channels. Do they describe the SAME ' +
    'opportunity (one programme, competition or scholarship, perhaps named differently or in ' +
    'another language)? Different contests, awards or programmes from the same organiser are ' +
    'NOT the same.\n\n' +
    `A: ${show(a)}\n\nB: ${show(b)}\n\nAnswer with one word: yes or no.`
  );
}

/** True only for a clear "yes" from the model. */
export function isSameListing(answer) {
  return /^\W*yes\b/i.test(String(answer ?? ''));
}
