"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

/** Base radius of the reveal disc. The disc is scaled up from this rather than
 *  sized to the viewport: sizing it to reach the far corner meant a composited
 *  texture several thousand pixels square, for a plain circle. */
const DISC_R = 100;
const GROW_MS = 520;
const FADE_MS = 260;

/** Resolves on whichever comes first: the animation finishing, or `ms` elapsing.
 *  A backgrounded tab never finishes its animations, which used to strand the
 *  toggle mid-reveal with the disc still covering the page. */
function settle(animation: Animation, ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    animation.finished
      .catch(() => {})
      .finally(() => { clearTimeout(timer); resolve(); });
  });
}

export function ThemeToggle() {
  const { toggleTheme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const disc = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);
  const [status, setStatus] = useState('');

  useEffect(() => () => {
    // Navigating away mid-reveal must not leave the disc covering the page.
    alive.current = false;
    disc.current?.remove();
  }, []);

  const handle = useCallback(() => {
    if (busy.current) return; // one reveal at a time — mashing used to drop toggles

    const announce = () => {
      if (alive.current) {
        setStatus(document.documentElement.classList.contains('dark') ? 'Dark theme' : 'Light theme');
      }
    };
    const btn = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!btn || reduce) { toggleTheme(); announce(); return; }

    // This reveal used to animate clip-path on a View Transitions snapshot,
    // which Chrome cannot composite: every frame re-rastered a full-viewport
    // snapshot on the main thread, so any long task stalled it mid-sweep. A
    // disc grown with transform and faded with opacity is compositor-owned, so
    // main-thread work cannot reach it. The theme swaps underneath the disc
    // while it covers the viewport, so that repaint is never seen.
    const root = document.documentElement;
    const nextIsDark = !root.classList.contains('dark');
    const bg = getComputedStyle(root)
      .getPropertyValue(nextIsDark ? '--bg-dark' : '--bg-light').trim();
    if (!bg) { toggleTheme(); announce(); return; } // no colour to reveal — swap plainly

    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    // Reach the farthest corner, so the grown disc covers the whole viewport.
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:${x - DISC_R}px;top:${y - DISC_R}px;` +
      `width:${DISC_R * 2}px;height:${DISC_R * 2}px;border-radius:50%;background:hsl(${bg});` +
      `pointer-events:none;z-index:9999;transform:scale(0);` +
      `will-change:transform,opacity;contain:strict`;
    document.body.appendChild(el);
    disc.current = el;
    busy.current = true;

    (async () => {
      await settle(el.animate(
        { transform: ['scale(0)', `scale(${reach / DISC_R})`] },
        // Linear: the edge sweeps out at one constant speed. An eased curve
        // covers ~95% of the distance in the first half and then crawls, which
        // reads as the animation stalling even when no frame is dropped.
        { duration: GROW_MS, easing: 'linear', fill: 'forwards' },
      ), GROW_MS + 400);

      toggleTheme();
      announce();

      await settle(el.animate(
        { opacity: [1, 0] },
        { duration: FADE_MS, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' },
      ), FADE_MS + 400);

      el.remove();
      if (disc.current === el) disc.current = null;
      busy.current = false;
    })();
  }, [toggleTheme]);

  return (
    <>
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        onClick={handle}
        aria-label="Toggle light and dark theme"
        className="h-10 w-10 rounded-xl border-border transition-colors hover:bg-secondary"
      >
        {/* Driven by the `dark` class rather than React state, so the right icon
            is on screen at first paint instead of after hydration. */}
        <span className="relative block h-4 w-4">
          <Sun className="absolute inset-0 h-4 w-4 text-gold transition-all duration-700 -rotate-90 scale-0 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100" />
          <Moon className="absolute inset-0 h-4 w-4 text-foreground transition-all duration-700 rotate-0 scale-100 opacity-100 dark:rotate-90 dark:scale-0 dark:opacity-0" />
        </span>
      </Button>
      <span role="status" aria-live="polite" className="sr-only">{status}</span>
    </>
  );
}
