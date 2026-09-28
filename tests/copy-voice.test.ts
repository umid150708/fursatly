/**
 * The paper's voice. The editorial section is labelled the way a newspaper
 * labels its own statement ("From the editors"), not like a landing page
 * ("Our mission", "Why Fursatly?"), and the masthead motto names no place.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translations } from '../src/lib/translations';

const expected = {
  en: { missionLead: 'From the editors', whyFursatly: 'How we work', heroKicker: 'No borders. Only deadlines.' },
  uz: { missionLead: 'Tahririyatdan', whyFursatly: 'Qanday ishlaymiz', heroKicker: "Chegara yo'q. Faqat muddat bor." },
  ru: { missionLead: 'От редакции', whyFursatly: 'Как мы работаем', heroKicker: 'Без границ. Только дедлайны.' },
} as const;

describe('editorial voice', () => {
  for (const [loc, keys] of Object.entries(expected)) {
    it(`${loc}: editorial labels and motto`, () => {
      const t = translations[loc as keyof typeof translations];
      expect(t.missionLead, `${loc}.missionLead`).toBe(keys.missionLead);
      expect(t.whyFursatly, `${loc}.whyFursatly`).toBe(keys.whyFursatly);
      expect(t.heroKicker, `${loc}.heroKicker`).toBe(keys.heroKicker);
      // Not rendered anywhere today; kept in step so it cannot bring a region back.
      expect(t.footerTagline, `${loc}.footerTagline`).toBe(keys.heroKicker);
    });
  }

  it('the share card carries the motto', () => {
    const og = readFileSync(new URL('../src/app/opengraph-image.tsx', import.meta.url), 'utf8');
    expect(og).toContain("const STRIP = 'No borders. Only deadlines.';");
  });
});
