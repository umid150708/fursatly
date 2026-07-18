"use client";

import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const options: { id: 'uz' | 'en' | 'ru'; label: string }[] = [
  { id: 'uz', label: "O'zbekcha" },
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' },
];

export function LanguageSwitcher() {
  const { locale, setLocale, isMounted } = useLanguage();

  if (!isMounted) {
    return (
      <Button variant="outline" size="sm" aria-label="Change language" className="h-10 gap-2 rounded-xl border-border px-3 sm:px-4">
        <Globe className="h-4 w-4" /> <span className="hidden sm:inline">...</span>
      </Button>
    );
  }

  const current = options.find(o => o.id === locale) || options[1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Change language"
          className="h-10 gap-2 rounded-xl border-border px-3 font-semibold transition-colors hover:bg-secondary sm:px-4"
        >
          <Globe className="h-4 w-4 text-accent" />
          {/* Full label on ≥sm; compact language code on phones to keep the nav from overflowing. */}
          <span className="hidden sm:inline">{current.label}</span>
          <span className="sm:hidden">{current.id.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl border-border p-1.5 shadow-2xl">
        {options.map(opt => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => setLocale(opt.id)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              locale === opt.id ? 'bg-primary/8 text-primary font-bold' : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-8 items-center justify-center rounded-md bg-secondary text-[11px] font-bold tracking-wide text-muted-foreground">
                {opt.id.toUpperCase()}
              </span>
              <span className="text-sm font-semibold">{opt.label}</span>
            </div>
            {locale === opt.id && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
