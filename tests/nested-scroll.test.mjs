/**
 * Lenis smooth-scroll takes every wheel event on the page, so a box with its
 * own scrollbar never moves under a mouse wheel or trackpad: the mentor chat
 * sat still while the page behind it scrolled. Lenis leaves an element alone
 * only when it carries data-lenis-prevent, so every scroll box outside the
 * shadcn primitives must opt out.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const UI = join(SRC, 'components', 'ui');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (p === UI) return [];
    if (statSync(p).isDirectory()) return sources(p);
    return name.endsWith('.tsx') ? [p] : [];
  });
}

/** The JSX opening tag around `index`: from its `<Tag` to the `>` that ends it. */
function openingTag(text, index) {
  const start = text.lastIndexOf('<', index);
  const close = /\n\s*>|"\s*>|\}\s*>/g;
  close.lastIndex = index;
  const end = close.exec(text)?.index ?? text.length;
  return text.slice(start, end);
}

describe('nested scroll boxes', () => {
  const boxes = sources(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/overflow-(?:y-)?(?:auto|scroll)\b/g)].map((m) => ({
      where: relative(SRC, file),
      tag: openingTag(text, m.index),
    }));
  });

  it('finds the scroll boxes it guards', () => {
    expect(boxes.length).toBeGreaterThanOrEqual(3);
  });

  it.each(boxes.map((b) => [b.where, b.tag]))('%s opts out of Lenis', (_where, tag) => {
    expect(tag).toContain('data-lenis-prevent');
  });
});
