"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, translations } from '@/lib/translations';
import { PreferenceStore } from '@/lib/preferences';

type LanguageContextType = {
  locale: Locale;
  /** Shows a language without keeping it — the switcher goes through
   *  usePreferences(), which does. */
  setLocale: (locale: Locale) => void;
  t: typeof translations.en;
  isMounted: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setLocale(PreferenceStore.browser().load().locale);
  }, []);

  const t = translations[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isMounted }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
