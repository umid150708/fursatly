/** Unit tests for slug generation — pure string work, no I/O. */
import { describe, it, expect } from 'vitest';
import { slugify, ensureUniqueSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('kebab-cases a plain English title', () => {
    expect(slugify('Global Youth Contest 2026')).toBe('global-youth-contest-2026');
  });
  it('drops apostrophes and punctuation (Uzbek latin)', () => {
    expect(slugify("Wise Up Farg'ona 2026!")).toBe('wise-up-fargona-2026');
  });
  it('collapses runs of separators and trims edges', () => {
    expect(slugify('  Hello --- World  ')).toBe('hello-world');
  });
  it('transliterates Cyrillic so Russian titles stay readable', () => {
    expect(slugify('Стипендия 2026')).toBe('stipendiya-2026');
  });
  it('caps length at a word boundary', () => {
    const long = 'a'.repeat(40) + ' ' + 'b'.repeat(40);
    const s = slugify(long, 60);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
  it('returns empty string when nothing survives (e.g. emoji-only)', () => {
    expect(slugify('🎉🎉')).toBe('');
  });
});

describe('ensureUniqueSlug', () => {
  it('returns the base when it is free', () => {
    expect(ensureUniqueSlug('chevening', () => false)).toBe('chevening');
  });
  it('appends -2, -3… until free', () => {
    const taken = new Set(['chevening', 'chevening-2']);
    expect(ensureUniqueSlug('chevening', (s) => taken.has(s))).toBe('chevening-3');
  });
  it('falls back to a short id when the base is empty', () => {
    const s = ensureUniqueSlug('', () => false, 'af12cd34ef56');
    expect(s).toBe('opportunity-af12cd34');
  });
});
