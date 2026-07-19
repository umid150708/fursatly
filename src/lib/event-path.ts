/**
 * The path segment for an opportunity: its slug when it has one, else the
 * legacy UUID. Single source of truth so every link site (cards, saved list,
 * reminder + broadcast DMs) builds the same clean URL.
 */
export function eventSlug(ev: { id: string; slug?: string | null; research_data?: { slug?: string | null } | null }): string {
  return ev.slug || ev.research_data?.slug || ev.id;
}

/** True when a route param is a bare UUID (legacy link) rather than a slug. */
export const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
