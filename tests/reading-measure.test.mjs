/**
 * Body text runs in one column. CSS multi-column balances text at its
 * midpoint, so short paragraphs were cut mid-clause ("…balki | ular haqida…",
 * "…jahon | darajasidagi…"), and on the web long text in columns makes readers
 * scroll back up. Event overviews sampled live were 23–117 words: all short.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

describe('reading measure', () => {
  const files = sources(SRC);

  it('no stylesheet splits text into columns', () => {
    for (const f of files.filter((p) => p.endsWith('.css'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/column-count|columns-news/);
    }
  });

  it('no component uses the retired columns-news class', () => {
    for (const f of files.filter((p) => /\.tsx?$/.test(p))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/columns-news/);
    }
  });
});
