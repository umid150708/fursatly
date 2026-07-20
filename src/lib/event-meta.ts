/**
 * Pure builders for per-event SEO metadata (<title>, meta description).
 * Server-only callers (generateMetadata, OG image) — keep this free of React
 * and Supabase so it stays unit-testable like slug.ts / reminder-logic.ts.
 */

const SITE = 'Fursatly';
const MAX_DESCRIPTION = 160;

type EventMetaRow = {
  title?: string | null;
  description?: string | null;
  research_data?: { extendedDescription?: string | null } | null;
};

export function metaTitle(row: EventMetaRow): string {
  const title = (row.title ?? '').trim() || 'Opportunity';
  return title.toLowerCase().includes(SITE.toLowerCase()) ? title : `${title} — ${SITE}`;
}

export function metaDescription(row: EventMetaRow): string {
  const raw =
    (row.research_data?.extendedDescription ?? '').trim() ||
    (row.description ?? '').trim() ||
    `Discover scholarships, competitions and programs for Central Asian students on ${SITE}.`;

  const flat = raw.replace(/\s+/g, ' ').trim();
  if (flat.length <= MAX_DESCRIPTION) return flat;

  // Cut on the last word boundary that leaves room for the ellipsis.
  const slice = flat.slice(0, MAX_DESCRIPTION - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : slice.length).trimEnd()}…`;
}
