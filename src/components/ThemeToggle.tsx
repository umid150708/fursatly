"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

const SWEEP_MS = 620;

/** Radii for a wipe whose visible pace is even from start to finish.
 *
 *  Growing the radius at a fixed rate does NOT look like a fixed pace: the arc
 *  ends up running nearly tangent to the far edges, so the point where it
 *  crosses them races ahead. Measured on the viewport edges, a linear sweep
 *  runs 1.3-2.2x faster over its last 15% than through the middle, and how much
 *  depends on the aspect ratio and where the button sits — so a single hand-
 *  picked easing curve cannot fix every screen. This spaces the radii by how
 *  far the visible front travels rather than evenly in time, computed for the
 *  viewport in front of the user. Costs well under a millisecond.
 */
function sweepRadii(w: number, h: number, cx: number, cy: number, end: number): number[] {
  const STEPS = 1200;
  const FRAMES = 24;
  // Where the arc crosses each viewport edge; null before it reaches that edge.
  const front = (r: number): (number | null)[] => {
    const leg = (a: number) => { const v = r * r - a * a; return v > 0 ? Math.sqrt(v) : null; };
    const top = leg(cy), bottom = leg(h - cy), left = leg(cx), right = leg(w - cx);
    return [
      top === null ? null : cx - top,
      bottom === null ? null : cx - bottom,
      left === null ? null : cy + left,
      right === null ? null : cy + right,
    ];
  };

  const dr = end / STEPS;
  const cap = 20 * dr; // discount the instant an edge is first touched
  const travel = [0];
  let prev = front(0);
  for (let i = 1; i <= STEPS; i++) {
    const cur = front(i * dr);
    let fastest = 0;
    for (let k = 0; k < 4; k++) {
      const a = cur[k], b = prev[k];
      if (a !== null && b !== null) fastest = Math.max(fastest, Math.abs(a - b));
    }
    travel.push(travel[i - 1] + Math.min(fastest, cap));
    prev = cur;
  }

  const total = travel[STEPS];
  if (!(total > 0)) return [0, end]; // degenerate viewport — fall back to a plain wipe
  const radii: number[] = [];
  for (let k = 0; k <= FRAMES; k++) {
    const want = (k / FRAMES) * total;
    let lo = 0, hi = STEPS;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (travel[mid] < want) lo = mid + 1; else hi = mid; }
    radii.push((lo / STEPS) * end);
  }
  radii[0] = 0;
  radii[FRAMES] = end;
  return radii;
}

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
        // Keyframes are evenly spaced in time and the radii are not: see
        // sweepRadii. Interpolation between them stays linear.
        { clipPath: sweepRadii(innerWidth, innerHeight, x, y, end).map((r) => `circle(${r}px at ${x}px ${y}px)`) },
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
