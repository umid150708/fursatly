import { canonicalSource, type CanonicalSource } from './canonicalCategory';

/**
 * Per-category color — a refined jewel tone drawn from Uzbek textile colors
 * (teal, gold, pomegranate, indigo). Returned as a reference to the
 * theme-aware `--cat-*` tokens in globals.css, where the light and dark
 * variants live (both tuned to ≥4.5:1 as text on their background). The value
 * slots anywhere a bare HSL triple did: `hsl(${catHue(s)})` and
 * `--hue: ${catHue(s)}` both resolve through the CSS variable.
 */
const CATEGORY_VAR: Record<CanonicalSource, string> = {
  Scholarships: 'var(--cat-scholarships)',
  Competitions: 'var(--cat-competitions)',
  'Summer Programs': 'var(--cat-summer-programs)',
  Research: 'var(--cat-research)',
  Volunteer: 'var(--cat-volunteer)',
  STEM: 'var(--cat-stem)',
  Internships: 'var(--cat-internships)',
  Workshops: 'var(--cat-workshops)',
  Other: 'var(--cat-other)',
};

export const catHue = (source?: string | null): string => CATEGORY_VAR[canonicalSource(source)];
