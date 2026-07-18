'use client';

import { useEffect, useRef, useState } from 'react';
import { Wordmark } from '@/components/brand/Wordmark';
import { DoppiIcon } from '@/components/brand/DoppiIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AccountButton } from '@/components/AccountButton';

/**
 * Scroll-reactive nav: transparent over the hero, condenses + goes solid once
 * you scroll, hides on scroll-down and reveals on scroll-up, and carries a
 * teal→gold scroll-progress line. The doppi emblem is the brand mark.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // rAF-polled scroll state — robust to Lenis (reads the real scrollY each
  // frame). Progress is written straight to the DOM to avoid per-frame renders;
  // React state only flips on the scrolled/hidden thresholds.
  useEffect(() => {
    let raf = 0;
    let last = window.scrollY;
    let curScrolled = false;
    let curHidden = false;
    const tick = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;

      const nextScrolled = y > 40;
      if (nextScrolled !== curScrolled) { curScrolled = nextScrolled; setScrolled(nextScrolled); }

      let nextHidden = curHidden;
      if (y > 320 && y > last + 4) nextHidden = true;        // scrolling down
      else if (y < last - 4 || y < 320) nextHidden = false;  // scrolling up / near top
      if (nextHidden !== curHidden) { curHidden = nextHidden; setHidden(nextHidden); }

      last = y;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-500 ease-out ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* scroll progress line */}
      <div
        ref={barRef}
        className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-accent via-gold to-accent"
        aria-hidden
      />
      <div
        className={`transition-colors duration-500 ${
          scrolled ? 'border-b border-border bg-background/80 backdrop-blur-md' : 'border-b border-transparent'
        }`}
      >
        <div
          className={`container flex items-center justify-between transition-[height] duration-500 ${
            scrolled ? 'h-14' : 'h-20'
          }`}
        >
          <a href="/" aria-label="Fursatly home" className="group flex items-center gap-3">
            <span
              className={`grid shrink-0 place-items-center rounded-xl bg-[#0e1522] ring-1 ring-gold/40 transition-all duration-500 group-hover:ring-gold/70 ${
                scrolled ? 'h-9 w-9' : 'h-11 w-11'
              }`}
            >
              <DoppiIcon className={scrolled ? 'h-6 w-6' : 'h-7 w-7'} />
            </span>
            <span className={`transition-all duration-500 ${scrolled ? 'text-lg' : 'text-2xl'}`}>
              <Wordmark />
            </span>
          </a>
          <div className="flex items-center gap-1 md:gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <AccountButton />
          </div>
        </div>
      </div>
    </header>
  );
}
