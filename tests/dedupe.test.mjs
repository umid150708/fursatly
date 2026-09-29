/**
 * Duplicate detection for scraped listings. Every positive case below is a real
 * pair that reached the live events table on 2026-09-28 because the old guard
 * only matched titles exactly.
 */
import { describe, it, expect } from 'vitest';
import { normalizeTitle, findDuplicate, suspectDuplicates, sameListingPrompt, isSameListing } from '../src/pipeline/dedupe.mjs';

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
    expect(normalizeTitle('Babson Summer Program 2026/27')).toBe('babson summer');
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

/**
 * Six more pairs reached the live table and were retired by hand on
 * 2026-09-30. Each one names the rule that now catches it.
 */
describe('findDuplicate — pairs retired on 2026-09-30', () => {
  const at = (id, title, deadline = null, urls = []) => ({ id, title, deadline, urls });

  it('folds programme/program and the filler word "program"', () => {
    expect(findDuplicate(at(null, 'JINR Summer Student Programme 2026', '2026-11-04T00:00:00'),
      [at('a', 'JINR Summer Student Program 2026', '2026-11-27T00:00:00')])?.id).toBe('a');
    expect(findDuplicate(at(null, 'KAIST Summer Research Internship Program', '2026-12-30T00:00:00'),
      [at('a', 'KAIST Summer Research Internship', '2026-12-02T00:00:00')])?.id).toBe('a');
    expect(findDuplicate(at(null, 'OECD Internship'), [at('a', 'OECD Internship Programme')])?.id).toBe('a');
  });

  it('matches a short title whose words all appear in the longer one', () => {
    const existing = [at('a', 'Scientific Internships at the Institute of Science and Technology Austria (ISTA)', '2026-12-17T00:00:00')];
    expect(findDuplicate(at(null, 'Scientific Internships in Austria'), existing)?.id).toBe('a');
  });

  it('matches two titles that point at the same post or page', () => {
    const existing = [at('a', 'Toshkent Yozgi Maktabi', null, ['https://t.me/grantlar/18774'])];
    expect(findDuplicate(at(null, 'Yozgi maktab', null, ['https://t.me/grantlar/18774/']), existing)?.id).toBe('a');
  });

  it('sends the same site, the same deadline and a shared name to the model', () => {
    const existing = [at('a', 'United World Colleges (UWC) 2026', '2026-09-30T00:00:00', ['https://uz.uwc.org/eligibility-criteria/'])];
    const dup = at(null, 'UWC International Baccalaureate (IB) Diploma Scholarship', '2026-09-30T00:00:00', ['https://www.uz.uwc.org/']);
    expect(findDuplicate(dup, existing)).toBeNull();
    expect(suspectDuplicates(dup, existing).map((e) => e.id)).toEqual(['a']);
  });

  it('asks rather than merges two contests closing the same day', () => {
    const existing = [at('a', 'Writers of the Future', '2026-09-30T00:00:00', ['https://grantlar.uz/writers-of-the-future/'])];
    const other = at(null, 'The Illustrators Of The Future', '2026-09-30T00:00:00', ['https://grantlar.uz/the-illustrators-of-the-future/']);
    expect(findDuplicate(other, existing)).toBeNull();
    expect(suspectDuplicates(other, existing).map((e) => e.id)).toEqual(['a']);
  });

  it('puts both listings in the question and trusts only a clear yes', () => {
    const q = sameListingPrompt(
      { title: 'United World Colleges (UWC) 2026', deadline: '2026-09-30T00:00:00', description: 'IB Diploma' },
      { title: 'UWC IB Diploma Scholarship', deadline: null },
    );
    expect(q).toContain('United World Colleges (UWC) 2026 (deadline 2026-09-30)');
    expect(q).toContain('UWC IB Diploma Scholarship (deadline none)');
    expect(isSameListing('yes')).toBe(true);
    expect(isSameListing('Yes.')).toBe(true);
    expect(isSameListing('no')).toBe(false);
    expect(isSameListing('')).toBe(false);
    expect(isSameListing(undefined)).toBe(false);
  });

  it('never suspects listings on different days or with only generic words in common', () => {
    const existing = [
      at('a', 'ERP Study Scholarships (DAAD)', '2026-11-02T00:00:00', ['https://www.daad.de/erp']),
      at('b', 'KAIST International Student Undergraduate Scholarships', '2026-10-22T00:00:00'),
    ];
    expect(suspectDuplicates(at(null, 'EPOS Scholarships', '2026-10-31T00:00:00', ['https://www.daad.de/epos']), existing)).toEqual([]);
    expect(suspectDuplicates(at(null, 'Tsinghua International Undergraduate Scholarships', '2026-10-22T00:00:00'), existing)).toEqual([]);
    expect(suspectDuplicates(at(null, 'Open call', null), existing)).toEqual([]);
  });

  it('keeps apart listings that only share a channel, a form host or a big site', () => {
    const existing = [
      at('a', 'Ko‘mak loyihasi', null, ['https://t.me/Qarz320']),
      at('b', 'ERP Study Scholarships (DAAD)', '2026-11-02T00:00:00', ['https://www.daad.de/']),
      at('c', 'KAIST International Student Undergraduate Scholarships', '2026-10-22T00:00:00', ['https://admissions.kaist.ac.kr/international/']),
      at('d', 'IOI 2026 Volunteer Opportunity', null, ['https://forms.gle/2vFzdoMMF3s3AMcG9']),
    ];
    expect(findDuplicate(at(null, 'Yoshlar tadbirkorligi krediti', null, ['https://t.me/Qarz320']), existing)).toBeNull();
    expect(findDuplicate(at(null, 'EPOS Development-Related Postgraduate Courses (DAAD)', '2026-10-31T00:00:00', ['https://www.daad.de/']), existing)).toBeNull();
    expect(findDuplicate(at(null, 'KAIST Summer Research Internship', '2026-12-02T00:00:00', ['https://admission.kaist.ac.kr/internship/']), existing)).toBeNull();
    expect(findDuplicate(at(null, 'Maker Camp 2026', null, ['https://forms.gle/Bb4a8tDS2n87XCAp7']), existing)).toBeNull();
  });

  it('does not merge same-site listings whose deadlines differ', () => {
    const existing = [at('a', 'Writers of the Future', '2026-09-30T00:00:00', ['https://www.writersofthefuture.com/contact/'])];
    expect(findDuplicate(at(null, 'The Illustrators Of The Future', '2026-12-31T00:00:00', ['https://www.writersofthefuture.com/contact/']), existing)).toBeNull();
  });
});
