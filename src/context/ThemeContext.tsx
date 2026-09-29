"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PreferenceStore, type Theme } from '@/lib/preferences';

type ThemeContextType = {
  theme: Theme;
  /** Flips the theme on screen and returns the new one. Does not keep it —
   *  the controls go through usePreferences(), which does. */
  toggleTheme: () => Theme;
  /** Shows a theme without keeping it (PreferencesSync applying an account's). */
  setTheme: (theme: Theme) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => 'light',
  setTheme: () => {},
  isDark: false,
});

/** What is on screen right now. The pre-paint probe in layout.tsx sets the class
 *  before React exists, so <html> — not React state — is the source of truth.
 *  Reading it back keeps state, DOM and rapid clicks from drifting apart. */
function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'; // SSR: matches the probe's default
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Keep the mobile browser chrome in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(root).getPropertyValue('--background').trim();
  if (meta && bg) meta.setAttribute('content', `hsl(${bg})`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Seeded from the DOM so the very first client render already knows the real
  // theme — it used to start on one fixed theme for everyone and correct itself after
  // hydration, which flashed the wrong toggle icon at light-theme visitors.
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    // Reconcile with what this visitor should see and re-assert the class:
    // React 19's production hydration strips <html> attributes it did not itself render.
    setTheme(PreferenceStore.browser().load().theme);
  }, [setTheme]);

  const toggleTheme = useCallback(() => {
    // Derived from the DOM, not from `theme`: a click landing while a previous
    // update was still in flight used to read a stale value and be swallowed.
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme, isDark: theme === 'dark' }),
    [theme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
