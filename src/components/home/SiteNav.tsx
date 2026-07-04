'use client';

import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/brand/Wordmark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/** Fixed top nav — transparent over the hero, solid once you scroll past it. */
export function SiteNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        solid ? 'border-b border-border bg-background/80 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="container flex h-16 items-center justify-between md:h-20">
        <a href="/" aria-label="Fursatly home" className="text-xl md:text-2xl">
          <Wordmark />
        </a>
        <div className="flex items-center gap-1 md:gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
