"use client";

import { useLanguage } from '@/context/LanguageContext';
import { usePreferences } from '@/context/PreferencesSync';

const options: { id: 'uz' | 'en' | 'ru'; label: string }[] = [
  { id: 'uz', label: "O'zbekcha" },
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' },
];

/**
 * Three ruled language codes, set like an edition marker. Every option is
 * visible, so switching is one tap; the current one is inked in. Nothing is
 * marked active until the saved locale has been read, so the server render
 * never claims the wrong language.
 */
export function LanguageSwitcher() {
  const { locale, isMounted } = useLanguage();
  const { setLocale } = usePreferences();

  return (
    <div role="group" aria-label="Language" className="flex h-10 items-stretch border border-foreground">
      {options.map((o, i) => {
        const active = isMounted && locale === o.id;
        return (
          <button
            key={o.id}
            type="button"
            lang={o.id}
            title={o.label}
            aria-label={o.label}
            aria-pressed={active}
            onClick={() => setLocale(o.id)}
            className={`font-label min-w-[2.5rem] px-2 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
              i > 0 ? 'border-l border-foreground' : ''
            } ${active ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}
          >
            {o.id.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
