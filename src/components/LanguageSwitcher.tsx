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

const options: { id: 'uz' | 'en' | 'ru'; label: string; flag: string }[] = [
  { id: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { id: 'en', label: 'English',   flag: '🇬🇧' },
  { id: 'ru', label: 'Русский',   flag: '🇷🇺' },
];

export function LanguageSwitcher() {
  const { locale, setLocale, isMounted } = useLanguage();

  if (!isMounted) {
    return (
      <Button variant="outline" size="sm" className="gap-2 h-10 px-4 rounded-xl">
        <Globe className="h-4 w-4" /> ...
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
          className="gap-2 border-primary/20 hover:bg-primary/5 transition-all h-10 px-4 rounded-xl font-bold"
        >
          <Globe className="h-4 w-4 text-primary" />
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 p-1.5 rounded-2xl border-primary/10 shadow-2xl">
        {options.map(opt => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => setLocale(opt.id)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              locale === opt.id ? 'bg-primary/8 text-primary font-bold' : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">{opt.flag}</span>
              <span className="text-sm font-semibold">{opt.label}</span>
            </div>
            {locale === opt.id && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
