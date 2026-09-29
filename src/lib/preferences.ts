import type { Locale } from './translations';

/**
 * English + light (the Gazette's morning edition) is what every visitor opens
 * with. Only a choice saved on a signed-in account overrides it. Each field is
 * resolved on its own, first match wins:
 *
 *   account copy   localStorage — exists only while an account is signed in here
 *   guest choice   sessionStorage — this tab only, gone when it closes
 *   default        English + light
 *
 * Spec: docs/superpowers/specs/2026-09-30-guest-default-preferences-design.md
 */
export type Theme = 'light' | 'dark';
export type Preferences = { theme: Theme; locale: Locale };

export const DEFAULT_PREFERENCES: Preferences = { theme: 'light', locale: 'en' };

/** This device's copy of the signed-in account's `user_metadata.preferences`. */
export const ACCOUNT_PREFS_KEY = 'fursatly_account_prefs';
const GUEST_KEYS = { theme: 'fursatly_theme', locale: 'fursatly_locale' } as const;
/** Until 2026-09-30 every visitor's choice was kept here, forever. Never read again. */
const LEGACY_KEYS = [GUEST_KEYS.theme, GUEST_KEYS.locale];

/** Background behind the dark theme, for the mobile browser chrome. Mirrors
 *  --bg-dark in globals.css and the theme-color <meta> in layout.tsx. */
const DARK_CHROME = '#141210';

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';
export const isLocale = (v: unknown): v is Locale => v === 'uz' || v === 'en' || v === 'ru';

export function resolveTheme(saved: unknown): Theme {
  return isTheme(saved) ? saved : DEFAULT_PREFERENCES.theme;
}

export function resolveLocale(saved: unknown): Locale {
  return isLocale(saved) ? saved : DEFAULT_PREFERENCES.locale;
}

/** Only the valid fields; anything else the value carries is dropped. */
function sanitize(raw: unknown): Partial<Preferences> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<Preferences> = {};
  if (isTheme(r.theme)) out.theme = r.theme;
  if (isLocale(r.locale)) out.locale = r.locale;
  return out;
}

/** The choices saved on an account, from its `user_metadata`. */
export function accountPreferences(metadata: unknown): Partial<Preferences> {
  return sanitize((metadata as { preferences?: unknown } | null | undefined)?.preferences);
}

export type AuthStep = 'none' | 'apply-account' | 'reset';

/**
 * What to do when auth settles on `current` (a user id, or null when signed
 * out). `previous` is the id handled last time — undefined before the first.
 *
 * A sign-out resets whether or not the shared account copy is still there:
 * every open tab hears it, and whichever tab handles it first clears the copy
 * for all of them. A copy with nobody signed in is a session that lapsed.
 */
export function authStep(
  previous: string | null | undefined,
  current: string | null,
  hasAccountCopy: boolean,
): AuthStep {
  if (current === previous) return 'none';
  if (current) return 'apply-account';
  return typeof previous === 'string' || hasAccountCopy ? 'reset' : 'none';
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Reads and writes the three layers. Either storage may be missing, and the
 * real ones throw (not just return null) when site data is blocked — Safari
 * private mode, "block all cookies" — so every access is guarded and a failure
 * only means the choice is not kept.
 */
export class PreferenceStore {
  constructor(
    private readonly local: StorageLike | null,
    private readonly session: StorageLike | null,
  ) {}

  static browser(): PreferenceStore {
    const open = (pick: () => StorageLike) => {
      try { return pick(); } catch { return null; }
    };
    return new PreferenceStore(open(() => window.localStorage), open(() => window.sessionStorage));
  }

  /** What the page should show right now. */
  load(): Preferences {
    const account = this.readAccount() ?? {};
    return {
      theme: resolveTheme(account.theme ?? this.get(this.session, GUEST_KEYS.theme)),
      locale: resolveLocale(account.locale ?? this.get(this.session, GUEST_KEYS.locale)),
    };
  }

  /**
   * Keeps a choice the visitor just made. A guest's lasts for this tab only
   * (returns null). A signed-in account's goes into the account copy, and the
   * full merged set is returned for saving on the account itself.
   */
  save(change: Partial<Preferences>, signedIn: boolean): Partial<Preferences> | null {
    const clean = sanitize(change);
    if (!signedIn) {
      if (clean.theme) this.set(this.session, GUEST_KEYS.theme, clean.theme);
      if (clean.locale) this.set(this.session, GUEST_KEYS.locale, clean.locale);
      return null;
    }
    const next = { ...this.readAccount(), ...clean };
    this.writeAccount(next);
    return next;
  }

  /** The signed-in account's copy; null when no account is signed in here. */
  readAccount(): Partial<Preferences> | null {
    const raw = this.get(this.local, ACCOUNT_PREFS_KEY);
    if (raw === null) return null;
    try { return sanitize(JSON.parse(raw)); } catch { return {}; }
  }

  writeAccount(prefs: Partial<Preferences>): void {
    this.set(this.local, ACCOUNT_PREFS_KEY, JSON.stringify(sanitize(prefs)));
  }

  /** Signed out: nothing of the account, or of this tab's choices, is kept. */
  forgetAll(): void {
    this.remove(this.local, ACCOUNT_PREFS_KEY);
    this.remove(this.session, GUEST_KEYS.theme);
    this.remove(this.session, GUEST_KEYS.locale);
  }

  dropLegacy(): void {
    for (const key of LEGACY_KEYS) this.remove(this.local, key);
  }

  private get(storage: StorageLike | null, key: string): string | null {
    try { return storage?.getItem(key) ?? null; } catch { return null; }
  }

  private set(storage: StorageLike | null, key: string, value: string): void {
    try { storage?.setItem(key, value); } catch { /* shown now, just not kept */ }
  }

  private remove(storage: StorageLike | null, key: string): void {
    try { storage?.removeItem(key); } catch { /* nothing reachable to clear */ }
  }
}

/**
 * The pre-paint script for layout.tsx: applies dark before first paint using
 * the same theme rule as load(), so there is no flash of the wrong theme. Built
 * from the same keys so the two cannot drift; the tests run both against the
 * same storage states.
 */
export function themeProbeScript(): string {
  const account = JSON.stringify(ACCOUNT_PREFS_KEY);
  const guest = JSON.stringify(GUEST_KEYS.theme);
  return `(function(){try{
  var t=null;
  try{var a=JSON.parse(localStorage.getItem(${account})||'null');if(a&&(a.theme==='light'||a.theme==='dark'))t=a.theme;}catch(e){}
  if(t===null){try{t=sessionStorage.getItem(${guest});}catch(e){}}
  if(t==='dark'){document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${DARK_CHROME}');}
}catch(e){}})();`;
}
