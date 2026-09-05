"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveTheme, type Theme } from '@/lib/preferences';

const STORAGE_KEY = 'fursatly_theme';

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
});

/* localStorage throws — it does not just return null — when site data is
   blocked (Safari private mode, "block all cookies"). Unguarded, that took the
   provider's effect down with it and left the toggle dead. */
function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeStored(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* session-only preference */ }
}

/** What is on screen right now. The pre-paint probe in layout.tsx sets the class
 *  before React exists, so <html> — not React state — is the source of truth.
 *  Reading it back keeps state, DOM and rapid clicks from drifting apart. */
function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'; // SSR: matches the probe's default
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
  // theme — it used to start 'dark' for everyone and correct itself after
  // hydration, which flashed the wrong toggle icon at light-theme visitors.
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    // Reconcile with the saved preference and re-assert the class: React 19's
    // production hydration strips <html> attributes it did not itself render.
    const saved = resolveTheme(readStored());
    setTheme(saved);
    applyTheme(saved);
  }, []);

  useEffect(() => {
    // A toggle in one tab should not leave the others on the old theme.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = resolveTheme(e.newValue);
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    // Derived from the DOM, not from `theme`: a click landing while a previous
    // update was still in flight used to read a stale value and be swallowed.
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writeStored(next);
    applyTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, isDark: theme === 'dark' }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
