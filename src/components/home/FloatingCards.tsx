'use client';

import { useEffect, useRef } from 'react';
import { useMotion } from '@/components/motion/MotionConfig';

export interface FloatCard {
  id: string;
  title: string;
  category: string;
  hue: string; // bare HSL triple
}

// Home anchors in the empty upper-right space (fractions of the hero box) — the
// original scatter. Each card free-floats within a small orbit of its anchor
// rather than sitting perfectly still.
const SLOTS = [
  { top: 0.13, right: 0.01, w: 228 },
  { top: 0.11, right: 0.29, w: 176 },
  { top: 0.40, right: 0.04, w: 238 },
  { top: 0.33, right: 0.23, w: 168 },
  { top: 0.66, right: 0.03, w: 200 },
  { top: 0.60, right: 0.27, w: 182 },
] as const;

const R = 260;   // cursor influence radius (px)
const PAD = 12;  // keep cards this far inside the container edges

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/**
 * Category cards scattered in the empty hero space. Each one drifts freely on a
 * slow, looping path around its home anchor (a bounded "float", not a roam of the
 * whole screen), and reacts to the cursor — a magnetic pull + scale when it comes
 * near, bigger when it lands on top. Real buttons: clicking one opens that event.
 * The container stays pointer-events-none so empty gaps pass through to the hero;
 * only the card buttons re-enable pointer events. Desktop-only, static on the
 * reduced-motion tier.
 */
export function FloatingCards({ cards, onOpen }: { cards: FloatCard[]; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-card]'));
    if (!items.length) return;

    const measure = () => {
      const r = container.getBoundingClientRect();
      return { W: r.width, H: r.height };
    };
    let { W, H } = measure();

    // Per-card drift params. The home anchor is clamped inward by the drift
    // amplitude so the whole orbit stays on-screen (no clipping at the edges).
    const st = items.map((el, i) => {
      const s = SLOTS[i];
      const w = el.offsetWidth, h = el.offsetHeight;
      const ax = 40 + Math.random() * 24;   // horizontal orbit amplitude
      const ay = 30 + Math.random() * 20;   // vertical orbit amplitude
      const hx = clamp((1 - s.right) * W - w, PAD + ax, W - w - PAD - ax);
      const hy = clamp(s.top * H,             PAD + ay, H - h - PAD - ay);
      return {
        w, h, hx, hy, ax, ay,
        fx: 0.14 + Math.random() * 0.16,     // slow, unequal frequencies → non-repeating figure-8
        fy: 0.11 + Math.random() * 0.15,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        rotAmp: 2 + Math.random() * 3,
        fr: 0.10 + Math.random() * 0.12,
        pr: Math.random() * Math.PI * 2,
        ox: 0, oy: 0, s: 1,
      };
    });

    const place = (c: typeof st[number], el: HTMLElement) => {
      el.style.transform = `translate3d(${c.hx}px, ${c.hy}px, 0)`;
      el.style.opacity = '1';
    };
    st.forEach((c, i) => place(c, items[i]));

    if (!motion) return; // reduced-motion: static at the home anchors, no drift

    let mx = -9999, my = -9999;
    const onMove = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    };
    const onLeave = () => { mx = -9999; my = -9999; };
    const onResize = () => {
      const m = measure(); W = m.W; H = m.H;
      st.forEach((c, i) => {
        // Re-measure: if this card's last measurement happened while the
        // container was still `hidden` (below the lg breakpoint), offsetWidth/
        // Height read 0 then and must not be trusted for the clamp below.
        const el = items[i];
        c.w = el.offsetWidth || c.w;
        c.h = el.offsetHeight || c.h;
        const s = SLOTS[i];
        c.hx = clamp((1 - s.right) * W - c.w, PAD + c.ax, W - c.w - PAD - c.ax);
        c.hy = clamp(s.top * H,               PAD + c.ay, H - c.h - PAD - c.ay);
      });
    };

    let raf = 0;
    const loop = () => {
      const t = performance.now() / 1000;
      const active = mx > -9998;
      items.forEach((el, i) => {
        const c = st[i];
        // free-floating base position: a slow looping orbit around the home anchor
        const bx = c.hx + c.ax * Math.sin(t * c.fx + c.px);
        const by = c.hy + c.ay * Math.sin(t * c.fy + c.py);
        const baseRot = c.rotAmp * Math.sin(t * c.fr + c.pr);

        // cursor reaction — magnetic pull + scale, bigger when it lands on top
        let tox = 0, toy = 0, ts = 1, over = false;
        if (active) {
          const cx = bx + c.w / 2, cy = by + c.h / 2;
          const dx = mx - cx, dy = my - cy;
          const dist = Math.hypot(dx, dy);
          if (dist < R) {
            const k = 1 - dist / R;
            tox = dx * k * 0.16; toy = dy * k * 0.16;
            ts = 1 + k * 0.06;
            over = Math.abs(dx) < c.w / 2 && Math.abs(dy) < c.h / 2;
            if (over) ts = 1.15;
          }
        }
        c.ox += (tox - c.ox) * 0.1;
        c.oy += (toy - c.oy) * 0.1;
        c.s += (ts - c.s) * 0.1;

        el.style.transform = `translate3d(${bx + c.ox}px, ${by + c.oy}px, 0) rotate(${(over ? baseRot * 0.4 : baseRot).toFixed(2)}deg) scale(${c.s})`;
        el.style.zIndex = over ? '10' : '';
      });
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
    // Re-seed when the number of cards changes (category switch / first load).
  }, [motion, cards.length]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[1] hidden lg:block">
      {cards.slice(0, SLOTS.length).map((c, i) => (
        <div
          key={i}
          data-card
          className="absolute left-0 top-0 opacity-0 transition-opacity duration-700 will-change-transform"
          style={{ width: SLOTS[i].w }}
        >
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            aria-label={`${c.category}: ${c.title}`}
            className="pointer-events-auto block w-full cursor-pointer rounded-xl border bg-card/65 p-4 text-left shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] backdrop-blur-md outline-none transition-shadow hover:shadow-[0_28px_70px_-28px_rgba(0,0,0,0.7)] focus-visible:ring-2 focus-visible:ring-accent"
            style={{ borderColor: `hsl(${c.hue} / 0.35)` }}
          >
            <span className="text-eyebrow font-semibold" style={{ color: `hsl(${c.hue})` }}>{c.category}</span>
            <p className="mt-2 line-clamp-2 font-display text-sm font-semibold leading-snug">{c.title}</p>
          </button>
        </div>
      ))}
    </div>
  );
}
