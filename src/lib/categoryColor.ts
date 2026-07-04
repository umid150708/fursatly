/**
 * A refined jewel-tone per category — drawn from Uzbek textile colors (teal,
 * gold, pomegranate, indigo) so the palette reads rich but coordinated, never
 * garish. Values are bare HSL triples for the `--hue` CSS custom property.
 */
export const CATEGORY_HUE: Record<string, string> = {
  Scholarships:      '186 74% 32%', // teal
  Competitions:      '41 64% 45%',  // gold
  'Summer Programs': '24 74% 50%',  // amber
  Research:          '244 42% 56%', // indigo
  Volunteer:         '158 46% 40%', // emerald
  STEM:              '208 68% 50%', // blue
  Internships:       '220 14% 46%', // slate
  Workshops:         '344 54% 50%', // pomegranate
  Fellowships:       '176 66% 34%', // deep teal
  Other:             '220 10% 45%',
};

export const catHue = (source?: string): string =>
  CATEGORY_HUE[source ?? 'Other'] ?? CATEGORY_HUE.Other;
