/**
 * Duplicate detection for scraped listings. Every positive case below is a real
 * pair that reached the live events table on 2026-09-28 because the old guard
 * only matched titles exactly.
 */
import { describe, it, expect } from 'vitest';
import { normalizeTitle, findDuplicate } from '../src/pipeline/dedupe.mjs';

const ev = (id, title, deadline = null) => ({ id, title, deadline });

describe('normalizeTitle', () => {
  it('folds case, curly quotes and punctuation', () => {
    expect(normalizeTitle("SDG Innovation Summit Malaysia ‘26")).toBe(normalizeTitle("SDG Innovation Summit Malaysia '26"));
    expect(normalizeTitle('Tom Howard/Margaret Reid Poetry Contest')).toBe('tom howard margaret reid poetry contest');
  });

  it('drops edition years in every spelling', () => {
    const base = normalizeTitle('Tom Howard/Margaret Reid Poetry Contest');
    expect(normalizeTitle('Tom Howard/Margaret Reid Poetry Contest 2026')).toBe(base);
    expect(normalizeTitle("Babson Summer Program '26")).toBe(normalizeTitle('Babson Summer Program ‘26'));
    expect(normalizeTitle('Babson Summer Program 2026/27')).toBe('babson summer program');
  });

  it('keeps the words that make a listing distinct', () => {
    expect(normalizeTitle('Writers of the Future')).not.toBe(normalizeTitle('The Illustrators Of The Future'));
  });
});

describe('findDuplicate', () => {
  it('matches the same listing re-posted with a year suffix', () => {
    const existing = [ev('a', 'Tom Howard/Margaret Reid Poetry Contest', '2026-10-01T00:00:00')];
    expect(findDuplicate(ev(null, 'Tom Howard/Margaret Reid Poetry Contest 2026', '2026-10-01T00:00:00'), existing)?.id).toBe('a');
  });

  it('matches curly-quote variants even a day apart', () => {
    const existing = [ev('a', "Babson Summer Program '26", '2026-10-10T00:00:00')];
    expect(findDuplicate(ev(null, 'Babson Summer Program ‘26', '2026-10-11T00:00:00'), existing)?.id).toBe('a');
  });

  it('matches a title that only adds a subtitle, when the deadlines agree', () => {
    const existing = [ev('a', "Yaponiya yozgi oromgohi '26", '2026-10-07T00:00:00')];
    const dup = ev(null, "Yaponiya yozgi oromgohi '26 (AYFN Travel Scholarship)", '2026-10-08T00:00:00');
    expect(findDuplicate(dup, existing)?.id).toBe('a');
  });

  it('does not merge a subtitle variant whose deadline is weeks away', () => {
    const existing = [ev('a', 'Global UGRAD Exchange', '2026-03-01T00:00:00')];
    expect(findDuplicate(ev(null, 'Global UGRAD Exchange 2026 (Spring cohort)', '2026-12-01T00:00:00'), existing)).toBeNull();
  });

  it('does not merge different programmes that share a word or two', () => {
    const existing = [ev('a', 'Writers of the Future', '2026-09-30T00:00:00'), ev('b', 'KAIST International Student Undergraduate Scholarships')];
    expect(findDuplicate(ev(null, 'The Illustrators Of The Future', '2026-09-30T00:00:00'), existing)).toBeNull();
    expect(findDuplicate(ev(null, 'International Agricultural University Admission'), existing)).toBeNull();
  });

  it('never treats a one- or two-word title as a subtitle match', () => {
    const existing = [ev('a', 'Chevening', '2026-10-06T00:00:00')];
    expect(findDuplicate(ev(null, 'Chevening Scholarship Workshop Tashkent', '2026-10-06T00:00:00'), existing)).toBeNull();
  });

  it('is safe with regex and LIKE metacharacters in titles', () => {
    const existing = [ev('a', 'Grant_100% (full)')];
    expect(findDuplicate(ev(null, 'Grant 100 full'), existing)?.id).toBe('a');
    expect(findDuplicate(ev(null, 'Grant_200% (full)'), existing)).toBeNull();
  });
});
