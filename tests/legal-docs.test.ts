/**
 * Legal documents: every locale must carry the same sections (by id), and
 * every locale must name the operator and the contact address — the two facts
 * a reader needs to exercise their rights.
 */
import { describe, it, expect } from 'vitest';
import { privacyDocs } from '../src/lib/legal/privacy';
import { termsDocs } from '../src/lib/legal/terms';
import { LEGAL_EMAIL, LEGAL_OPERATOR } from '../src/lib/legal/types';

const LOCALES = ['en', 'uz', 'ru'] as const;

describe.each([
  ['privacy', privacyDocs],
  ['terms', termsDocs],
])('%s docs', (_name, docs) => {
  it('exist for en, uz, ru', () => {
    expect(Object.keys(docs).sort()).toEqual(['en', 'ru', 'uz']);
  });

  it('have the same section ids in every locale', () => {
    const base = docs.en.sections.map((s) => s.id);
    for (const loc of LOCALES) {
      expect(docs[loc].sections.map((s) => s.id), loc).toEqual(base);
    }
  });

  it('name the operator and contact email in every locale', () => {
    for (const loc of LOCALES) {
      const text = docs[loc].sections.flatMap((s) => s.body).join('\n');
      expect(text, `${loc} operator`).toContain(LEGAL_OPERATOR);
      expect(text, `${loc} email`).toContain(LEGAL_EMAIL);
    }
  });

  it('has no empty headings or paragraphs', () => {
    for (const loc of LOCALES) {
      for (const s of docs[loc].sections) {
        expect(s.heading.trim().length, `${loc}/${s.id} heading`).toBeGreaterThan(0);
        expect(s.body.length, `${loc}/${s.id} body`).toBeGreaterThan(0);
        for (const p of s.body) expect(p.trim().length, `${loc}/${s.id}`).toBeGreaterThan(0);
      }
    }
  });
});
