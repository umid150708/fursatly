import type { Dict } from '@/lib/translations';

/**
 * The paper's sections — one per canonical category, in the order they run on
 * the front page, the section bar and the footer. `labelKey` indexes the
 * translation dictionary.
 */
export const SECTIONS = [
  { id: 'Scholarships', labelKey: 'catScholarships' },
  { id: 'Competitions', labelKey: 'catCompetitions' },
  { id: 'STEM', labelKey: 'catSTEM' },
  { id: 'Research', labelKey: 'catResearch' },
  { id: 'Workshops', labelKey: 'catWorkshops' },
  { id: 'Internships', labelKey: 'catInternships' },
  { id: 'Summer Programs', labelKey: 'catSummerPrograms' },
  { id: 'Volunteer', labelKey: 'catVolunteer' },
] as const satisfies readonly { id: string; labelKey: keyof Dict }[];

/** Link to a section from any page: the home page reads `?cat=` on load. */
export const sectionHref = (id: string | null) =>
  id ? `/?cat=${encodeURIComponent(id)}#opportunities` : '/#opportunities';
