import type { Locale } from './translations';

/**
 * First-visit defaults: dark theme + English. A saved preference always wins;
 * unknown/corrupt values fall back to the defaults. The pre-paint theme probe
 * in layout.tsx inlines the same rule as a string — keep them in sync.
 */
export type Theme = 'light' | 'dark';

export function resolveTheme(saved: string | null): Theme {
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

export function resolveLocale(saved: string | null): Locale {
  return saved === 'uz' || saved === 'en' || saved === 'ru' ? saved : 'en';
}
