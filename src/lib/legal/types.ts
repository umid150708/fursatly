import type { Locale } from '@/lib/translations';

/** The person legally responsible for the site, as printed in the documents. */
export const LEGAL_OPERATOR = 'Umidjon Norkuziev';
/** Single address for privacy, legal and content-removal requests. */
export const LEGAL_EMAIL = 'norqoziyevumidjon690@gmail.com';
/** ISO date shown as "Last updated" on both documents. Bump when the text changes. */
export const LEGAL_UPDATED = '2026-09-16';

export interface LegalSection {
  /** Stable anchor id — identical across locales (e.g. "cookies"). */
  id: string;
  heading: string;
  /** Paragraphs. A paragraph starting with "• " renders as a bullet. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  /** Short intro paragraph under the title. */
  intro: string;
  sections: LegalSection[];
}

export type LegalDocs = Record<Locale, LegalDoc>;
