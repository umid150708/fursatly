/**
 * English + light is what every visitor opens with. Only a choice saved on a
 * signed-in account overrides it; a guest's choice lasts for their tab only.
 * Spec: docs/superpowers/specs/2026-09-30-guest-default-preferences-design.md
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTheme,
  resolveLocale,
  accountPreferences,
  PreferenceStore,
  themeProbeScript,
  ACCOUNT_PREFS_KEY,
} from '../src/lib/preferences';

const DEFAULTS = { theme: 'light', locale: 'en' };

/** In-memory Storage. `broken` throws on every call, like Safari with site data blocked. */
function memoryStorage(initial = {}, { broken = false } = {}) {
  const data = new Map(Object.entries(initial));
  const guard = () => { if (broken) throw new Error('SecurityError'); };
  return {
    data,
    getItem: (k) => { guard(); return data.has(k) ? data.get(k) : null; },
    setItem: (k, v) => { guard(); data.set(k, String(v)); },
    removeItem: (k) => { guard(); data.delete(k); },
  };
}

/** One browser: localStorage shared by every tab, plus this tab's sessionStorage. */
function browser({ local = {}, session = {} } = {}) {
  const l = memoryStorage(local);
  const s = memoryStorage(session);
  return { local: l, session: s, store: new PreferenceStore(l, s) };
}

/** The next visit, or a new tab, in the same browser: same localStorage, empty session. */
const newTab = (b) => new PreferenceStore(b.local, memoryStorage());

const account = (prefs) => ({ [ACCOUNT_PREFS_KEY]: JSON.stringify(prefs) });

describe('resolveTheme', () => {
  it('defaults to light', () => {
    expect(resolveTheme(null)).toBe('light');
    expect(resolveTheme(undefined)).toBe('light');
  });

  it('keeps a valid theme', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('falls back to light on anything else', () => {
    expect(resolveTheme('banana')).toBe('light');
    expect(resolveTheme('')).toBe('light');
  });
});

describe('resolveLocale', () => {
  it('defaults to English', () => {
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('keeps a valid locale', () => {
    expect(resolveLocale('uz')).toBe('uz');
    expect(resolveLocale('ru')).toBe('ru');
    expect(resolveLocale('en')).toBe('en');
  });

  it('falls back to English on anything else', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('')).toBe('en');
  });
});

describe('first visit', () => {
  it('opens in English + light', () => {
    expect(browser().store.load()).toEqual(DEFAULTS);
  });

  it('ignores choices the old always-remember behaviour left in localStorage', () => {
    const b = browser({ local: { fursatly_theme: 'dark', fursatly_locale: 'uz' } });
    expect(b.store.load()).toEqual(DEFAULTS);
  });

  it('dropLegacy deletes those old keys', () => {
    const b = browser({ local: { fursatly_theme: 'dark', fursatly_locale: 'uz', other: 'kept' } });
    b.store.dropLegacy();
    expect([...b.local.data.keys()]).toEqual(['other']);
  });
});

describe('guest', () => {
  it('keeps a choice for the rest of the tab', () => {
    const b = browser();
    expect(b.store.save({ theme: 'dark' }, false)).toBeNull();
    expect(b.store.load()).toEqual({ theme: 'dark', locale: 'en' });
    b.store.save({ locale: 'uz' }, false);
    expect(b.store.load()).toEqual({ theme: 'dark', locale: 'uz' });
  });

  it('opens in English + light again in a new tab or on the next visit', () => {
    const b = browser();
    b.store.save({ theme: 'dark', locale: 'ru' }, false);
    expect(newTab(b).load()).toEqual(DEFAULTS);
  });

  it('never writes to localStorage', () => {
    const b = browser();
    b.store.save({ theme: 'dark', locale: 'uz' }, false);
    expect(b.local.data.size).toBe(0);
  });
});

describe('signed in', () => {
  it('keeps a choice on the account copy and returns the full set to save on the account', () => {
    const b = browser();
    expect(b.store.save({ theme: 'dark' }, true)).toEqual({ theme: 'dark' });
    // Merged with what is already saved, so a quick second change cannot drop the first.
    expect(b.store.save({ locale: 'ru' }, true)).toEqual({ theme: 'dark', locale: 'ru' });
    expect(b.store.readAccount()).toEqual({ theme: 'dark', locale: 'ru' });
  });

  it('opens every new tab in the saved choice', () => {
    const b = browser();
    b.store.save({ theme: 'dark', locale: 'ru' }, true);
    expect(newTab(b).load()).toEqual({ theme: 'dark', locale: 'ru' });
  });

  it("the account's choice beats this tab's guest choice", () => {
    const b = browser({ local: account({ theme: 'light' }), session: { fursatly_theme: 'dark' } });
    expect(b.store.load().theme).toBe('light');
  });

  it('a field the account never set falls back to the tab, then to the default', () => {
    const b = browser({ local: account({ theme: 'dark' }), session: { fursatly_locale: 'uz' } });
    expect(b.store.load()).toEqual({ theme: 'dark', locale: 'uz' });
    expect(newTab(b).load()).toEqual({ theme: 'dark', locale: 'en' });
  });

  it('readAccount is null with no account here, and {} for an account with nothing saved', () => {
    const b = browser();
    expect(b.store.readAccount()).toBeNull();
    b.store.writeAccount({});
    expect(b.store.readAccount()).toEqual({});
  });
});

describe('signing out', () => {
  it('forgetAll returns this tab and every new one to English + light', () => {
    const b = browser({ local: account({ theme: 'dark', locale: 'ru' }), session: { fursatly_theme: 'dark', fursatly_locale: 'uz' } });
    b.store.forgetAll();
    expect(b.store.readAccount()).toBeNull();
    expect(b.store.load()).toEqual(DEFAULTS);
    expect(newTab(b).load()).toEqual(DEFAULTS);
  });
});

describe('bad data', () => {
  it('ignores a corrupt account copy, which still counts as an account being here', () => {
    const b = browser({ local: { [ACCOUNT_PREFS_KEY]: '{nope' } });
    expect(b.store.load()).toEqual(DEFAULTS);
    expect(b.store.readAccount()).toEqual({});
  });

  it('ignores invalid values at every layer', () => {
    const b = browser({
      local: account({ theme: 'neon', locale: 'fr' }),
      session: { fursatly_theme: 'banana', fursatly_locale: 'de' },
    });
    expect(b.store.load()).toEqual(DEFAULTS);
  });

  it('drops invalid fields from a change', () => {
    const b = browser();
    expect(b.store.save({ theme: 'neon', locale: 'uz' }, true)).toEqual({ locale: 'uz' });
  });

  it('works on defaults when storage throws', () => {
    const store = new PreferenceStore(memoryStorage({}, { broken: true }), memoryStorage({}, { broken: true }));
    expect(store.load()).toEqual(DEFAULTS);
    expect(store.readAccount()).toBeNull();
    expect(() => {
      store.save({ theme: 'dark' }, false);
      store.save({ theme: 'dark' }, true);
      store.writeAccount({ theme: 'dark' });
      store.forgetAll();
      store.dropLegacy();
    }).not.toThrow();
  });

  it('works on defaults when there is no storage at all', () => {
    const store = new PreferenceStore(null, null);
    expect(store.load()).toEqual(DEFAULTS);
    expect(store.save({ theme: 'dark' }, true)).toEqual({ theme: 'dark' });
  });
});

describe('accountPreferences', () => {
  it("reads the account's saved choices from user_metadata", () => {
    expect(accountPreferences({ full_name: 'A', preferences: { theme: 'dark', locale: 'uz' } }))
      .toEqual({ theme: 'dark', locale: 'uz' });
  });

  it('is empty when nothing was saved', () => {
    for (const metadata of [undefined, null, {}, { preferences: null }, { preferences: 'dark' }]) {
      expect(accountPreferences(metadata)).toEqual({});
    }
  });

  it('drops invalid fields', () => {
    expect(accountPreferences({ preferences: { theme: 'neon', locale: 'ru', extra: 1 } })).toEqual({ locale: 'ru' });
  });
});

describe('themeProbeScript', () => {
  /** Runs the pre-paint script against fake storage and a fake <html>. */
  function runProbe(local, session) {
    const classes = new Set();
    let chrome = '#f3efe6';
    const document = {
      documentElement: { classList: { add: (c) => classes.add(c) } },
      querySelector: () => ({ setAttribute: (_name, value) => { chrome = value; } }),
    };
    new Function('localStorage', 'sessionStorage', 'document', themeProbeScript())(local, session, document);
    return { theme: classes.has('dark') ? 'dark' : 'light', chrome };
  }

  const cases = {
    'nothing saved': {},
    'legacy dark left in localStorage': { local: { fursatly_theme: 'dark' } },
    'guest chose dark in this tab': { session: { fursatly_theme: 'dark' } },
    'account saved dark': { local: account({ theme: 'dark' }) },
    'account light, tab dark': { local: account({ theme: 'light' }), session: { fursatly_theme: 'dark' } },
    'account with no theme, tab dark': { local: account({ locale: 'uz' }), session: { fursatly_theme: 'dark' } },
    'corrupt account, tab dark': { local: { [ACCOUNT_PREFS_KEY]: '{nope' }, session: { fursatly_theme: 'dark' } },
    'invalid account theme, tab dark': { local: account({ theme: 'neon' }), session: { fursatly_theme: 'dark' } },
    'account copy is a bare string': { local: { [ACCOUNT_PREFS_KEY]: '"dark"' } },
  };

  for (const [name, { local = {}, session = {} }] of Object.entries(cases)) {
    it(`agrees with load() — ${name}`, () => {
      const expected = new PreferenceStore(memoryStorage(local), memoryStorage(session)).load().theme;
      expect(runProbe(memoryStorage(local), memoryStorage(session)).theme).toBe(expected);
    });
  }

  it('paints the mobile browser chrome dark along with the page', () => {
    expect(runProbe(memoryStorage(account({ theme: 'dark' })), memoryStorage()).chrome).toBe('#141210');
  });

  it('leaves the page light when storage throws', () => {
    const broken = memoryStorage({}, { broken: true });
    expect(runProbe(broken, broken)).toEqual({ theme: 'light', chrome: '#f3efe6' });
  });
});
