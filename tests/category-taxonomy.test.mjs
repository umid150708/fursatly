/**
 * Category taxonomy: the DB `source` column is messy free-text (Fellowships,
 * Fellowship, Grants, Camps, Conferences…). Every UI surface must resolve it
 * to one canonical category so rail headings, filter chips, hues, and
 * translations always agree — and nothing leaks raw English into uz/ru.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalSource, rawSourcesFor, CANONICAL_SOURCES } from '../src/lib/canonicalCategory';
import { translations, translateSource } from '../src/lib/translations';
import { catHue } from '../src/lib/categoryColor';

describe('canonicalSource', () => {
  it('passes canonical values through unchanged', () => {
    for (const c of CANONICAL_SOURCES) expect(canonicalSource(c)).toBe(c);
  });

  it('maps every known DB alias to a canonical category', () => {
    expect(canonicalSource('Fellowships')).toBe('Scholarships');
    expect(canonicalSource('Fellowship')).toBe('Scholarships');
    expect(canonicalSource('Grants')).toBe('Scholarships');
    expect(canonicalSource('Camps')).toBe('Summer Programs');
    expect(canonicalSource('Conferences')).toBe('Workshops');
  });

  it('buckets unknown, blank, and missing values into Other', () => {
    expect(canonicalSource('Totally New Junk')).toBe('Other');
    expect(canonicalSource('')).toBe('Other');
    expect(canonicalSource(null)).toBe('Other');
    expect(canonicalSource(undefined)).toBe('Other');
  });
});

describe('rawSourcesFor', () => {
  it('returns the canonical value plus all aliases that fold into it', () => {
    expect(rawSourcesFor('Scholarships').sort()).toEqual(
      ['Fellowship', 'Fellowships', 'Grants', 'Scholarships'],
    );
    expect(rawSourcesFor('Workshops').sort()).toEqual(['Conferences', 'Workshops']);
  });

  it('returns just the category itself when it has no aliases', () => {
    expect(rawSourcesFor('STEM')).toEqual(['STEM']);
  });
});

describe('translateSource', () => {
  it('translates aliases via their canonical category (no raw English leaks)', () => {
    expect(translateSource('Fellowships', translations.uz)).toBe(translations.uz.srcScholarships);
    expect(translateSource('Grants', translations.uz)).toBe(translations.uz.srcScholarships);
    expect(translateSource('Camps', translations.ru)).toBe(translations.ru.srcSummerPrograms);
    expect(translateSource('Conferences', translations.uz)).toBe(translations.uz.srcWorkshops);
  });

  it('falls back to the Other label for unknown values instead of echoing them', () => {
    expect(translateSource('Mystery Meat', translations.uz)).toBe(translations.uz.srcOther);
  });
});

describe('catHue', () => {
  it('gives aliases the same hue as their canonical category', () => {
    expect(catHue('Grants')).toBe(catHue('Scholarships'));
    expect(catHue('Fellowships')).toBe(catHue('Scholarships'));
    expect(catHue('Camps')).toBe(catHue('Summer Programs'));
  });

  it('falls back to the Other hue for unknown or missing values', () => {
    expect(catHue('Mystery Meat')).toBe(catHue('Other'));
    expect(catHue(undefined)).toBe(catHue('Other'));
  });

  it('returns a theme-aware CSS variable reference for every canonical category', () => {
    for (const c of CANONICAL_SOURCES) expect(catHue(c)).toMatch(/^var\(--cat-[a-z-]+\)$/);
  });
});

// ── WCAG contrast: category colors are used as text in both themes ──────────
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

/** Extract `--name: H S% L%;` triples from a CSS block matched by `blockRe`. */
function varsIn(blockRe) {
  const block = css.match(blockRe)?.[0] ?? '';
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

function hslToRgb([h, s, l]) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('category color contrast (WCAG AA, 4.5:1 as text)', () => {
  const themes = [
    { name: 'light', vars: varsIn(/:root\s*{[^}]+}/) },
    { name: 'dark', vars: varsIn(/\.dark\s*{[^}]+}/) },
  ];

  for (const { name, vars } of themes) {
    it(`${name}: defines a --cat-* variable for every canonical category`, () => {
      const catVars = Object.keys(vars).filter((v) => v.startsWith('cat-'));
      expect(catVars.length).toBe(CANONICAL_SOURCES.length);
    });

    it(`${name}: every --cat-* color reaches 4.5:1 against the page background`, () => {
      const bg = vars.background;
      expect(bg, `${name} --background`).toBeTruthy();
      for (const [v, triple] of Object.entries(vars)) {
        if (!v.startsWith('cat-')) continue;
        const ratio = contrast(triple, bg);
        expect(ratio, `--${v} on ${name} background (${ratio.toFixed(2)}:1)`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
