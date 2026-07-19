/**
 * Shared shape for the homepage events list.
 *
 * The full `research_data` blob is ~800 KB across the list but the homepage
 * only reads three leaves of it (funding_type + uz/ru card titles). This
 * select pulls exactly those via PostgREST JSON paths — ~92% less wire — and
 * `mapEventListRow` folds them back into the `research_data` shape the
 * components already expect, so no component changes are needed.
 *
 * Used by BOTH the server page (ISR seed) and the client re-fetch, so the two
 * paths can never drift apart.
 */

export const EVENT_LIST_SELECT =
  'id,title,description,location,deadline,language,age_min,age_max,source,created_at,' +
  'slug:research_data->>slug,' +
  'funding_type:research_data->>funding_type,' +
  'uz_title:research_data->translations->uz->>title,' +
  'ru_title:research_data->translations->ru->>title';

/** Rebuild the nested research_data shape from the flat aliased columns. */
export function mapEventListRow(row: any): any {
  const { slug, funding_type, uz_title, ru_title, ...rest } = row ?? {};
  return {
    ...rest,
    slug: slug ?? null, // top-level for eventSlug()
    research_data: {
      slug: slug ?? null,
      funding_type: funding_type ?? null,
      translations: {
        ...(uz_title ? { uz: { title: uz_title } } : {}),
        ...(ru_title ? { ru: { title: ru_title } } : {}),
      },
    },
  };
}
