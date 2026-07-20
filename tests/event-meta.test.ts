import { describe, it, expect } from 'vitest';
import { metaDescription, metaTitle } from '../src/lib/event-meta';

const base = {
  title: 'Wise Up Fergana 2026',
  description: 'A summer camp for teens.\nApply now!',
  deadline: '2026-08-15',
  location: 'Fergana, Uzbekistan',
  research_data: {},
};

describe('metaTitle', () => {
  it('appends the site name', () => {
    expect(metaTitle(base)).toBe('Wise Up Fergana 2026 — Fursatly');
  });

  it('does not double-append when the title already mentions Fursatly', () => {
    expect(metaTitle({ ...base, title: 'Fursatly Launch Party' })).toBe('Fursatly Launch Party');
  });

  it('trims whitespace-padded titles', () => {
    expect(metaTitle({ ...base, title: '  Padded  ' })).toBe('Padded — Fursatly');
  });
});

describe('metaDescription', () => {
  it('prefers the enriched extendedDescription over the raw description', () => {
    const row = {
      ...base,
      research_data: { extendedDescription: 'Rich enriched summary of the camp.' },
    };
    expect(metaDescription(row)).toContain('Rich enriched summary');
  });

  it('falls back to the raw description', () => {
    expect(metaDescription(base)).toContain('A summer camp for teens.');
  });

  it('collapses newlines and repeated whitespace into single spaces', () => {
    expect(metaDescription(base)).not.toMatch(/\n|\s{2}/);
  });

  it('caps at 160 chars, cutting on a word boundary with an ellipsis', () => {
    const long = { ...base, description: 'word '.repeat(100), research_data: {} };
    const out = metaDescription(long);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\swor…$/); // no mid-word cut
  });

  it('returns a generic fallback when the event has no description at all', () => {
    const out = metaDescription({ ...base, description: null, research_data: null });
    expect(out.length).toBeGreaterThan(20);
    expect(out).toContain('Fursatly');
  });
});
