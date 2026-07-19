/**
 * URL slugs for opportunities. Pure — turns a title into a clean, readable
 * path segment ("Global Youth Contest 2026" → "global-youth-contest-2026")
 * and guarantees uniqueness against whatever is already taken.
 *
 * Slugs live in `research_data.slug`; the event page resolves either a slug or
 * a legacy UUID, so old links never break.
 */

const MAX_LEN = 60;

/** Minimal Cyrillic → Latin map so Russian titles produce readable slugs. */
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const transliterate = (s: string): string =>
  s.replace(/[а-яё]/gi, (ch) => {
    const lower = ch.toLowerCase();
    const mapped = CYR[lower];
    return mapped === undefined ? ch : mapped;
  });

/** Title → kebab-case slug (may be empty when nothing slug-able remains). */
export function slugify(input: string, maxLen = MAX_LEN): string {
  const base = transliterate((input ?? '').toLowerCase())
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')  // strip diacritic marks
    .replace(/['’‘ʻ`ʼ]/g, '')          // apostrophes vanish: Farg'ona → fargona
    .replace(/[^a-z0-9]+/g, '-')       // everything else → separators
    .replace(/^-+|-+$/g, '');          // trim edge separators

  if (base.length <= maxLen) return base;
  // Cut at the last separator inside the limit so we don't slice a word.
  const cut = base.slice(0, maxLen);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

/**
 * Make `base` unique. `isTaken(slug)` reports collisions (against the DB or an
 * in-memory set). When `base` is empty, fall back to `opportunity-<short-id>`.
 */
export function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => boolean,
  fallbackId = '',
): string {
  let candidate = base || `opportunity-${fallbackId.replace(/-/g, '').slice(0, 8)}`;
  if (!isTaken(candidate)) return candidate;
  for (let n = 2; ; n++) {
    candidate = `${base || 'opportunity'}-${n}`;
    if (!isTaken(candidate)) return candidate;
  }
}
