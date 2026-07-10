/**
 * Unit tests for the apply-link resolver — the pure logic that decides which
 * URL the "Apply on official website" button points at. No network calls.
 */
import { describe, it, expect } from 'vitest';
import {
  hostOf,
  isAggregator,
  isFetchableUrl,
  extractCandidates,
  pickOfficial,
} from '../src/pipeline/resolve-link.mjs';

describe('hostOf', () => {
  it('normalises www and case', () => {
    expect(hostOf('https://WWW.Example.COM/path')).toBe('example.com');
  });
  it('returns null for junk', () => {
    expect(hostOf('not a url')).toBeNull();
  });
});

describe('isAggregator', () => {
  it('flags known reposter hosts', () => {
    expect(isAggregator('https://edugrants.uz/scholarships/x')).toBe(true);
    expect(isAggregator('https://grantlar.uz/y/')).toBe(true);
  });
  it('leaves real program sites alone', () => {
    expect(isAggregator('https://daad.de/en')).toBe(false);
  });
});

describe('isFetchableUrl (SSRF guard)', () => {
  it('allows public web URLs', () => {
    expect(isFetchableUrl('https://example.org/apply')).toBe(true);
  });
  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'http://localhost/admin',
    'http://127.0.0.1:8080/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://172.16.0.1/',
    'http://[::1]/',
    'http://foo.internal/',
  ])('blocks %s', (url) => {
    expect(isFetchableUrl(url)).toBe(false);
  });
});

describe('extractCandidates', () => {
  const page = (links) =>
    links.map((l) => `<a href="${l}">x</a>`).join('\n');

  it('drops the aggregator itself, socials, trackers and assets', () => {
    const html = page([
      'https://edugrants.uz/other-post',
      'https://facebook.com/edugrants',
      'https://t.me/edugrants',
      'https://www.googletagmanager.com/gtag/js?id=X',
      'https://cdn.example.com/style.css',
      'https://icscompetition.org/',
      'https://icscompetition.org/en/submission',
    ]);
    const out = extractCandidates(html, 'https://edugrants.uz/scholarships/icsc');
    expect(out).toHaveLength(1);
    expect(out[0].host).toBe('icscompetition.org');
    expect(out[0].count).toBe(2); // two distinct URLs on that host
    expect(out[0].url).toBe('https://icscompetition.org/'); // shortest = canonical
  });

  it('ranks hosts by how many distinct URLs they got', () => {
    const html = page([
      'https://often.org/a', 'https://often.org/b', 'https://often.org/c',
      'https://once.org/x',
    ]);
    const out = extractCandidates(html, 'https://grantlar.uz/post/');
    expect(out.map((c) => c.host)).toEqual(['often.org', 'once.org']);
  });
});

describe('pickOfficial', () => {
  it('returns null with no candidates', async () => {
    expect(await pickOfficial([], 'X')).toBeNull();
  });
  it('takes a clear frequency winner without calling the LLM', async () => {
    const pick = await pickOfficial(
      [{ host: 'a.org', url: 'https://a.org', count: 3 }, { host: 'b.org', url: 'https://b.org', count: 1 }],
      'X',
      async () => { throw new Error('LLM must not be called'); },
    );
    expect(pick).toBe('https://a.org');
  });
  it('asks the LLM only on a tie, and respects its pick', async () => {
    const pick = await pickOfficial(
      [{ host: 'a.org', url: 'https://a.org', count: 1 }, { host: 'b.org', url: 'https://b.org', count: 1 }],
      'X',
      async () => ' 2 ',
    );
    expect(pick).toBe('https://b.org');
  });
  it('falls back to the top candidate when the LLM fails', async () => {
    const pick = await pickOfficial(
      [{ host: 'a.org', url: 'https://a.org', count: 1 }, { host: 'b.org', url: 'https://b.org', count: 1 }],
      'X',
      async () => { throw new Error('rate limited'); },
    );
    expect(pick).toBe('https://a.org');
  });
});
