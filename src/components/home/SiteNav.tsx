'use client';

import { useEffect, useRef, useState } from 'react';
import { Wordmark } from '@/components/brand/Wordmark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AccountButton } from '@/components/AccountButton';
import { useLanguage } from '@/context/LanguageContext';
import { SECTIONS, sectionHref } from '@/components/home/sections';
import { formatDateline } from '@/lib/dates';

interface SiteNavProps {
  /** `front` prints the full masthead above the section bar (home page only). */
  variant?: 'front' | 'inner';
  /** Home page: the section bar filters in place instead of linking. */
  activeSection?: string | null;
  onSection?: (id: string | null) => void;
}

/**
 * The paper's head: a dateline strip, the masthead (front page only), and a
 * sticky section bar carrying the nameplate, the sections and the controls,
 * with a vermilion reading-progress rule along its foot. On the front page the
 * small nameplate only joins the bar once the big masthead has scrolled away.
 */
export function SiteNav({ variant = 'inner', activeSection = null, onSection }: SiteNavProps) {
  const { t, locale } = useLanguage();
  const [dateline, setDateline] = useState('');
  const [stuck, setStuck] = useState(variant === 'inner');
  const mastRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Client-only: the server HTML is built ahead of time (ISR) and in English,
  // so a server-rendered date would be stale and in the wrong language.
  useEffect(() => { setDateline(formatDateline(new Date(), locale)); }, [locale]);

  useEffect(() => {
    if (variant !== 'front' || !mastRef.current) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    io.observe(mastRef.current);
    return () => io.disconnect();
  }, [variant]);

  // Reading progress. The scrollable distance is cached and refreshed by a
  // ResizeObserver: reading scrollHeight on every scroll event forces a layout
  // of the whole page, which on the home page cost most of a frame.
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    let max = 0;
    const measure = () => { max = document.documentElement.scrollHeight - window.innerHeight; };
    const paint = () => {
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    measure();
    paint();
    const ro = new ResizeObserver(() => { measure(); paint(); });
    ro.observe(document.body);
    window.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', paint);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const sectionLinks = (className: string) =>
    SECTIONS.map(({ id, labelKey }) => {
      const active = activeSection === id;
      const cls = `${className} ${active ? 'text-accent underline decoration-2 underline-offset-[6px]' : 'hover:text-accent'}`;
      return onSection ? (
        <button key={id} type="button" aria-pressed={active} onClick={() => onSection(active ? null : id)} className={cls}>
          {t[labelKey]}
        </button>
      ) : (
        <a key={id} href={sectionHref(id)} className={cls}>
          {t[labelKey]}
        </a>
      );
    });

  const linkCls = 'text-eyebrow shrink-0 whitespace-nowrap transition-colors';

  return (
    <>
      <header className="container">
        <div className="flex h-10 items-center justify-between gap-4 border-b border-foreground">
          <span className="text-eyebrow text-[0.75rem]">{dateline}</span>
          <span className="text-eyebrow hidden text-[0.75rem] sm:inline">{t.heroKicker}</span>
        </div>
        {variant === 'front' && (
          <div ref={mastRef} className="py-6 text-center md:py-9">
            <a href="/" aria-label="Fursatly" className="inline-block">
              <Wordmark className="text-masthead" />
            </a>
            <p className="mx-auto mt-6 max-w-2xl text-base italic leading-snug text-muted-foreground md:mt-9 md:text-lg">
              {t.mastheadTagline}
            </p>
          </div>
        )}
      </header>

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="container">
          {variant === 'front' && <div className="rule-double" aria-hidden />}
          <div className="flex h-14 items-center gap-5 border-b border-foreground xl:gap-7">
            {stuck && (
              <a href="/" aria-label="Fursatly" className="shrink-0 text-2xl motion-safe:animate-in motion-safe:fade-in">
                <Wordmark />
              </a>
            )}
            <nav aria-label={t.footerPlatform} className="no-scrollbar hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto xl:flex">
              {sectionLinks(`${linkCls} py-2`)}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              <AccountButton />
            </div>
          </div>
        </div>
        <div ref={progressRef} aria-hidden className="h-[2px] origin-left scale-x-0 bg-accent" />
      </div>

      {/* Below xl the sections get their own row, which scrolls sideways and
          stays out of the sticky bar so it does not eat a phone's screen. */}
      <nav aria-label={t.footerPlatform} className="container xl:hidden">
        <div className="no-scrollbar flex gap-5 overflow-x-auto border-b border-border">
          {sectionLinks(`${linkCls} py-3`)}
        </div>
      </nav>
    </>
  );
}
