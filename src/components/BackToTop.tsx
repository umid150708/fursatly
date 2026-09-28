'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const SHOW_AFTER_PX = 600;

/**
 * Floating "back to top" for long pages (home, event, account). Bottom-LEFT so
 * it never collides with the mentor bubble that owns the bottom-right corner.
 * Honors prefers-reduced-motion by jumping instead of smooth-scrolling.
 */
export function BackToTop() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // No rAF indirection: React batches these, setVisible with an unchanged
    // value is a no-op, and rAF is suspended in occluded tabs anyway.
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Route through Lenis when it owns the scroll (motion tier), else native.
    const lenis = (window as any).lenis;
    if (lenis && !reduce) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={t.backToTop}
      title={t.backToTop}
      className="fixed bottom-6 left-6 z-40 grid h-11 w-11 place-items-center border border-foreground bg-card text-foreground shadow-[3px_3px_0_hsl(var(--foreground)/0.15)] transition-colors hover:bg-foreground hover:text-background motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
