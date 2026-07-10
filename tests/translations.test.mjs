/**
 * Translation completeness: every locale must expose exactly the same keys.
 * Catches the classic bug where a key is added to English and forgotten in
 * Uzbek/Russian — which would crash or blank a label at runtime.
 */
import { describe, it, expect } from 'vitest';
import { translations } from '../src/lib/translations';

const locales = Object.keys(translations);

describe('translations', () => {
  it('covers en, uz, ru', () => {
    expect(locales.sort()).toEqual(['en', 'ru', 'uz']);
  });

  it('every locale has exactly the same keys', () => {
    const [base, ...rest] = locales;
    const baseKeys = Object.keys(translations[base]).sort();
    for (const loc of rest) {
      expect(Object.keys(translations[loc]).sort(), `locale "${loc}" key set`).toEqual(baseKeys);
    }
  });

  it('no empty values anywhere', () => {
    for (const loc of locales) {
      for (const [k, v] of Object.entries(translations[loc])) {
        const ok = Array.isArray(v) ? v.length > 0 && v.every(Boolean) : String(v).trim().length > 0;
        expect(ok, `${loc}.${k}`).toBe(true);
      }
    }
  });
});
