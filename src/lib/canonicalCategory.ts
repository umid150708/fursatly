/**
 * Canonical category taxonomy. The DB `source` column is messy free-text
 * (same pattern as `location` — see `locationBucket` in page.tsx), so every
 * consumer resolves it through here: one canonical set shared by filter chips,
 * rail headings, hues, and translations.
 */
export const CANONICAL_SOURCES = [
  'Scholarships',
  'Competitions',
  'Summer Programs',
  'Research',
  'Volunteer',
  'STEM',
  'Internships',
  'Workshops',
  'Other',
] as const;

export type CanonicalSource = (typeof CANONICAL_SOURCES)[number];

/** Known stray DB values folded into their nearest canonical category. */
const SOURCE_ALIASES: Record<string, CanonicalSource> = {
  Fellowship: 'Scholarships',
  Fellowships: 'Scholarships',
  Grants: 'Scholarships',
  Camps: 'Summer Programs',
  Conferences: 'Workshops',
};

const CANONICAL_SET = new Set<string>(CANONICAL_SOURCES);

/** Resolve a raw DB `source` to a canonical category; unknown/blank → Other. */
export function canonicalSource(raw?: string | null): CanonicalSource {
  const s = (raw ?? '').trim();
  if (CANONICAL_SET.has(s)) return s as CanonicalSource;
  return SOURCE_ALIASES[s] ?? 'Other';
}

/**
 * All raw DB values that fold into a canonical category — for server-side
 * `.in('source', …)` filters, so selecting a category also matches its aliases.
 */
export function rawSourcesFor(canonical: string): string[] {
  return [
    canonical,
    ...Object.keys(SOURCE_ALIASES).filter((raw) => SOURCE_ALIASES[raw] === canonical),
  ];
}
