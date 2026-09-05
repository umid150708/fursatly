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
    // Not rendering offscreen sections is what makes the flip cheap. It has to
    // be `content-visibility: hidden` on sections measured to be offscreen, not
    // `auto` on all of them: `auto` treats every section as not-relevant until
    // the NEXT rendering pass, so a snapshot taken now captures them all blank —
    // which left the reveal with nothing to wipe over and read as an instant
    // snap. `hidden` is unconditional, and onscreen sections stay untouched.
    // contain-intrinsic-size describes the CONTENT box, so padding is added back
    // on top: pinning offsetHeight grew the page by ~1100px and snapped scroll.
    const measured = Array.from(document.querySelectorAll<HTMLElement>('section, footer'))
      .map((el) => {                               // all reads first, then all writes
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          el,
          offscreen: r.bottom < -200 || r.top > innerHeight + 200,
          w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
        };
      });
    const skipped = measured.filter((m) => m.offscreen);
    for (const m of skipped) {
      m.el.dataset.vtSkip = '';
      m.el.style.containIntrinsicSize = `auto ${m.w}px auto ${m.h}px`;
    }

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
      for (const m of skipped) { delete m.el.dataset.vtSkip; m.el.style.containIntrinsicSize = ''; }
      busy.current = false;
      // Announced here rather than off `ready`: an aborted transition rejects
      // that promise, and the theme still changed — the announcement must not
      // be the thing that goes missing.
      announce();
    };

    const transition = (document as unknown as {
      startViewTransition: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
    }).startViewTransition(() => { toggleTheme(); });

    transition.ready.then(() => new Promise<void>((go) => {
      // The flip repaints the whole page — measured at ~8 dropped frames — and
      // that work lands right where the sweep would start. Hold the old snapshot
      // for two frames so the repaint finishes behind it, then sweep over the
      // settled result. The wait is invisible: the old snapshot is on screen.
      requestAnimationFrame(() => requestAnimationFrame(() => go()));
    })).then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        // The radius growing at a constant rate does NOT look like a constant
        // pace. The circle starts at the button in the top-right corner, so
        // near the end its arc runs almost tangent to the left edge and the
        // point where it crosses that edge races down the screen — modelled at
        // 1.79x the mid-animation speed over the last 15%, which is the late
        // acceleration. easeOutExpo overcorrected the other way (0.03x at the
        // end, 4.8x at the start: the "fast then frozen" version). This curve
        // was solved against that model: the visible front travels at 1.01x at
        // the end and 1.02x at the start relative to the middle.
        { duration: SWEEP_MS, easing: 'cubic-bezier(0.15, 0.30, 0.55, 0.70)', pseudoElement: '::view-transition-new(root)' },
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
