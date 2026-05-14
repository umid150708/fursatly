"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, translations } from '@/lib/translations';

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: typeof translations.en;
  isMounted: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('uz');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('fursatly_locale') as Locale;
    if (saved && (saved === 'uz' || saved === 'en' || saved === 'ru')) {
      setLocale(saved);
    }
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fursatly_locale', newLocale);
    }
  };

  const t = translations[locale];

  // Dynamically apply body theme classes after mounting to prevent hydration errors
  useEffect(() => {
    if (isMounted) {
      const body = document.body;
      if (locale === 'uz') {
        body.classList.add('uzbek-theme');
      } else {
        body.classList.remove('uzbek-theme');
      }
    }
  }, [locale, isMounted]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale: handleSetLocale, t, isMounted }}>
      <div className={`min-h-screen ${isMounted && locale === 'uz' ? 'uzbek-theme' : ''}`}>
        {children}
      </div>
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