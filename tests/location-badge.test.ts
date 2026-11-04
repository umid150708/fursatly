import { describe, it, expect } from 'vitest';
import { locationBadges, locationBadgeHtml, flagOf, FLAG_EMOJI } from '../src/lib/location-badge';

const emojis = (loc?: string | null) => locationBadges(loc).map((b) => b.emoji).join(' ');

describe('locationBadges', () => {
  it('turns English country names into flags', () => {
    expect(emojis('South Korea')).toBe('🇰🇷');
    expect(emojis('USA')).toBe('🇺🇸');
    expect(emojis('United Kingdom')).toBe('🇬🇧');
    expect(emojis('UAE')).toBe('🇦🇪');
  });

  it('reads Uzbek spellings, with or without apostrophes', () => {
    expect(emojis('AQSh')).toBe('🇺🇸');
    expect(emojis("O'zbekiston")).toBe('🇺🇿');
    expect(emojis('Oʻzbekiston')).toBe('🇺🇿');
    expect(emojis('O‘zbekiston (Onlayn)')).toBe('🇺🇿');
    expect(emojis('Janubiy Koreya')).toBe('🇰🇷');
    expect(emojis('Buyuk Britaniya')).toBe('🇬🇧');
  });

  it('finds the country behind a city, and reads the longer name first', () => {
    expect(emojis('Jeneva, Shveysariya')).toBe('🇨🇭');
    expect(emojis('Pekin, Xitoy')).toBe('🇨🇳');
    expect(emojis('Samarqand')).toBe('🇺🇿');
    expect(emojis('San Diego, USA or Online')).toBe('🇺🇸');
    expect(emojis('Geneva, Switzerland and various UNHCR offices worldwide')).toBe('🇨🇭');
  });

  it('gives every country in the string its flag, in order, deduped, at most three', () => {
    expect(emojis('Various (US, Uzbekistan)')).toBe('🇺🇸 🇺🇿');
    expect(emojis('Tashkent, Uzbekistan')).toBe('🇺🇿');
    expect(emojis('Germany, France, Italy, Spain')).toBe('🇩🇪 🇫🇷 🇮🇹');
  });

  it('uses 🌐 for online and 🌍 for global, but a named country wins', () => {
    expect(emojis('Online')).toBe('🌐');
    expect(emojis('International (Online)')).toBe('🌐');
    expect(emojis('International')).toBe('🌍');
    expect(emojis('Worldwide')).toBe('🌍');
    expect(emojis('Multiple')).toBe('🌍');
    expect(emojis('Online (USA)')).toBe('🇺🇸');
  });

  it('does not mistake the word "us" for the United States', () => {
    expect(emojis('Join us in the cloud')).toBe('');
  });

  it('returns nothing for blank or unreadable locations instead of guessing', () => {
    expect(emojis('')).toBe('');
    expect(emojis(null)).toBe('');
    expect(emojis(undefined)).toBe('');
    expect(emojis('Somewhere nice')).toBe('');
  });
});

describe('animated flag ids', () => {
  it('has the same 🇺🇿 and 🇬🇧 the post builder already uses for languages', () => {
    expect(FLAG_EMOJI.UZ).toBe('5449829434334912605');
    expect(FLAG_EMOJI.GB).toBe('5202196682497859879');
  });

  it('builds flags from ISO codes', () => {
    expect(flagOf('US')).toBe('🇺🇸');
    expect(flagOf('UZ')).toBe('🇺🇿');
  });

  it('wraps a badge as a tg-emoji tag with the plain flag as fallback', () => {
    expect(locationBadgeHtml('USA')).toBe(`<tg-emoji emoji-id="${FLAG_EMOJI.US}">🇺🇸</tg-emoji>`);
    expect(locationBadgeHtml('Nowhere in particular')).toBe('');
  });

  it('covers nearly every country with an animated flag', () => {
    expect(Object.keys(FLAG_EMOJI).length).toBeGreaterThan(240);
  });
});
