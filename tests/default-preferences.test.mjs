/**
 * First-visit defaults: light theme (the Gazette's morning edition) + English.
 * A saved preference always wins; anything unknown/corrupt falls back to the
 * defaults.
 */
import { describe, it, expect } from 'vitest';
import { resolveTheme, resolveLocale } from '../src/lib/preferences';

describe('resolveTheme', () => {
  it('defaults to light when nothing is saved', () => {
    expect(resolveTheme(null)).toBe('light');
  });

  it('honors a saved preference', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('falls back to light on corrupt values', () => {
    expect(resolveTheme('banana')).toBe('light');
    expect(resolveTheme('')).toBe('light');
  });
});

describe('resolveLocale', () => {
  it('defaults to English when nothing is saved', () => {
    expect(resolveLocale(null)).toBe('en');
  });

  it('honors a saved locale', () => {
    expect(resolveLocale('uz')).toBe('uz');
    expect(resolveLocale('ru')).toBe('ru');
    expect(resolveLocale('en')).toBe('en');
  });

  it('falls back to English on corrupt values', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('')).toBe('en');
  });
});
