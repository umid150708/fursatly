'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuth, useDb } from '@/supabase';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  ACCOUNT_PREFS_KEY,
  DEFAULT_PREFERENCES,
  PreferenceStore,
  accountPreferences,
  authStep,
  type Preferences,
} from '@/lib/preferences';
import type { Locale } from '@/lib/translations';

/** Puts preferences on screen without keeping them anywhere. */
function useShow() {
  const { setTheme } = useTheme();
  const { setLocale } = useLanguage();
  return useCallback((prefs: Partial<Preferences>) => {
    if (prefs.theme) setTheme(prefs.theme);
    if (prefs.locale) setLocale(prefs.locale);
  }, [setTheme, setLocale]);
}

/**
 * Keeps the language and theme on screen in step with who is signed in.
 * Renders nothing. Spec: docs/superpowers/specs/2026-09-30-guest-default-preferences-design.md
 */
export function PreferencesSync() {
  const { user, isLoading } = useAuth();
  const show = useShow();
  // undefined until auth first resolves; after that, the user id (or null) last applied.
  const appliedFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    PreferenceStore.browser().dropLegacy();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const store = PreferenceStore.browser();
    const id = user?.id ?? null;
    // Once per sign-in, not per user object: token refreshes and our own saves
    // hand back a new one, and re-applying it could undo a change made since.
    const step = authStep(appliedFor.current, id, store.readAccount() !== null);
    appliedFor.current = id;

    if (step === 'apply-account' && user) {
      const saved = accountPreferences(user.user_metadata);
      store.writeAccount(saved);
      show(saved);
    } else if (step === 'reset') {
      // Signed out, or the session lapsed: back to what every visitor sees.
      store.forgetAll();
      show(DEFAULT_PREFERENCES);
    }
  }, [isLoading, user, show]);

  useEffect(() => {
    // A change saved in another tab while signed in on this browser.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACCOUNT_PREFS_KEY || e.newValue === null) return;
      show(PreferenceStore.browser().readAccount() ?? {});
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [show]);

  return null;
}

/**
 * What the language and theme controls call: shows the change, then keeps it —
 * for this tab when a guest, on the account (and this device's copy) when
 * signed in.
 */
export function usePreferences() {
  const db = useDb();
  const { user } = useAuth();
  const { toggleTheme: flipTheme } = useTheme();
  const { setLocale: showLocale } = useLanguage();

  const keep = useCallback((change: Partial<Preferences>) => {
    const toAccount = PreferenceStore.browser().save(change, user !== null);
    if (!toAccount) return;
    // The device copy is already written, so this page stays right even if the
    // save fails; the next page load goes back to whatever the account holds.
    const warn = (why: unknown) => console.warn('[preferences] not saved to the account:', why);
    db.auth.updateUser({ data: { preferences: toAccount } }).then(
      ({ error }) => { if (error) warn(error.message); },
      warn,
    );
  }, [db, user]);

  const toggleTheme = useCallback(() => keep({ theme: flipTheme() }), [flipTheme, keep]);

  const setLocale = useCallback((locale: Locale) => {
    showLocale(locale);
    keep({ locale });
  }, [showLocale, keep]);

  return { toggleTheme, setLocale };
}
