"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

const SWEEP_MS = 620;

export function ThemeToggle() {
  const { toggleTheme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const [status, setStatus] = useState('');

  useEffect(() => () => {
    alive.current = false;
    document.documentElement.classList.remove('theme-sweep');
  }, []);

  const handle = useCallback(() => {
    if (busy.current) return; // one sweep at a time — mashing used to drop toggles

    const announce = () => {
      if (alive.current) {
        setStatus(document.documentElement.classList.contains('dark') ? 'Dark theme' : 'Light theme');
      }
    };
    const btn = ref.current;
    const root = document.documentElement;
    const supported = typeof (document as { startViewTransition?: unknown }).startViewTransition === 'function';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!btn || !supported || reduce) { toggleTheme(); announce(); return; }

    // A circular reveal of the real page: the incoming theme is wiped in over
    // the outgoing one, so text and cards change as the edge passes them rather
    // than being hidden behind anything. Only View Transitions can put two
    // renderings of the same DOM on screen at once, so the sweep is a clip-path
    // animation on the new snapshot.
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    busy.current = true;
    // Skipping offscreen sections is what makes the flip cheap, but a skipped
    // section collapses to its contain-intrinsic-size estimate — the page gets
    // shorter and the scroll position snaps. Pin each one to the height it
    // actually has, so the placeholder is exactly the size it replaces.
    // contain-intrinsic-size describes the CONTENT box, so padding and border
    // get added back on top of it — pinning offsetHeight made every section
    // taller by its own padding and grew the page by ~1100px.
    const sections = Array.from(document.querySelectorAll<HTMLElement>('section, footer'));
    const boxes = sections.map((el) => {           // all reads first, then all writes
      const cs = getComputedStyle(el);
      return {
        w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      };
    });
    sections.forEach((el, i) => {
      el.style.containIntrinsicSize = `auto ${boxes[i].w}px auto ${boxes[i].h}px`;
    });

    // The sweep re-paints the newly revealed region every frame, so anything
    // there that forces a backdrop read-back (backdrop-filter, mix-blend-mode)
    // is paid for on every one of them. Dropped for the duration, and applied
    // BEFORE the snapshot so both captures match and nothing pops mid-sweep.
    root.classList.add('theme-sweep');

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      root.classList.remove('theme-sweep');
      for (const el of sections) el.style.containIntrinsicSize = '';
      busy.current = false;
      // Announced here rather than off `ready`: an aborted transition rejects
      // that promise, and the theme still changed — the announcement must not
      // be the thing that goes missing.
      announce();
    };

    const transition = (document as unknown as {
      startViewTransition: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
    }).startViewTransition(() => { toggleTheme(); });

    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        // Linear: one constant speed from start to finish. The previous eased
        // curve covered ~95% of the distance in its first half and then
        // crawled, which reads as a stall even with no dropped frames.
        { duration: SWEEP_MS, easing: 'linear', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {
      // An aborted transition (backgrounded tab, or a second toggle) rejects
      // `ready`; restore() still runs off `finished` and the timeout below.
    });

    transition.finished.then(restore, restore);
    setTimeout(restore, SWEEP_MS + 900); // safety net if it never settles
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
