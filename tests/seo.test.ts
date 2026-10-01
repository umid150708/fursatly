/**
 * What search engines need to find the site by name: the WebSite/Organization
 * structured data on the homepage, and the IndexNow key file Bing and Yandex
 * fetch to trust our pings.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { siteJsonLd, jsonLdScript } from '../src/lib/site-schema';

describe('homepage structured data', () => {
  const graph = siteJsonLd()['@graph'];
  const website = graph.find((n) => n['@type'] === 'WebSite')!;
  const org = graph.find((n) => n['@type'] === 'Organization')!;

  it('names the site "Fursatly" at the apex homepage', () => {
    expect(website.name).toBe('Fursatly');
    expect(website.url).toBe('https://fursatly.uz/');
  });

  it('gives the brand a logo and its Telegram channel', () => {
    expect(org.name).toBe('Fursatly');
    expect(org.logo).toBe('https://fursatly.uz/icon.png');
    expect(org.sameAs).toContain('https://t.me/fursatly');
  });

  it('cannot close its own script tag', () => {
    expect(jsonLdScript({ x: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});

describe('IndexNow key file', () => {
  const dir = new URL('../public/', import.meta.url);
  const keys = readdirSync(dir).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));

  it('exists exactly once and holds its own name', () => {
    expect(keys).toHaveLength(1);
    expect(readFileSync(new URL(keys[0], dir), 'utf8')).toBe(keys[0].replace(/\.txt$/, ''));
  });
});
