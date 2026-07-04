'use client';

import { useEffect, useRef } from 'react';
import { useMotion } from '@/components/motion/MotionConfig';

export interface FloatCard {
  title: string;
  category: string;
  hue: string; // bare HSL triple
}

// Scatter slots — kept to the top + right so they orbit the left-aligned headline.
const SLOTS = [
  { style: { top: '13%', right: '1%'  }, depth: 1.10, w: 228, delay: '0s'   },
  { style: { top: '11%', right: '29%' }, depth: 0.70, w: 176, delay: '1.3s' },
  { style: { top: '40%', right: '4%'  }, depth: 0.55, w: 238, delay: '0.5s' },
  { style: { top: '33%', right: '23%' }, depth: 1.35, w: 168, delay: '1.0s' },
  { style: { top: '66%', right: '3%'  }, depth: 1.00, w: 200, delay: '1.9s' },
  { style: { top: '60%', right: '27%' }, depth: 0.85, w: 182, delay: '0.9s' },
] as const;

const R = 300;          // cursor influence radius (px)
const LERP = 0.12;      // smoothing

/**
 * Category cards scattered around the hero that react to the cursor: a gentle
 * global drift, a magnetic pull + tilt when the cursor comes near, and a
 * scale-up when it lands over a card. Decorative (pointer-events-none), so the
 * hover is computed from cursor geometry rather than real pointer events; that
 * way the cards never block the hero. Desktop-only, reduced-motion safe.
 */
export function FloatingCards({ cards }: { cards: FloatCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !ref.current) return;
    const container = ref.current;
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-depth]'));

    // Smoothed + target transform state per card.
    const st = items.map(() => ({ x: 0, y: 0, s: 1, r: 0 }));
    let bases: { cx: number; cy: number; hw: number; hh: number }[] = [];
    const measure = () => {
      bases = items.map((el) => ({
        cx: el.offsetLeft + el.offsetWidth / 2,
        cy: el.offsetTop + el.offsetHeight / 2,
        hw: el.offsetWidth / 2,
        hh: el.offsetHeight / 2,
      }));
    };
    measure();

    let mx = -9999, my = -9999; // cursor, relative to the container
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    };
    const onLeave = () => { mx = -9999; my = -9999; };

    let raf = 0;
    const loop = () => {
      const rect = container.getBoundingClientRect();
      const active = mx > -9998;
      const gx = active ? mx / rect.width - 0.5 : 0;
      const gy = active ? my / rect.height - 0.5 : 0;

      items.forEach((el, i) => {
        const b = bases[i];
        const depth = parseFloat(el.dataset.depth || '1');
        // base: gentle global drift
        let tx = gx * depth * -26;
        let ty = gy * depth * -20;
        let ts = 1, tr = 0, over = false;

        if (active) {
          const dx = mx - b.cx, dy = my - b.cy;
          const dist = Math.hypot(dx, dy);
          if (dist < R) {
            const t = 1 - dist / R;           // 0..1 closeness
            tx += dx * t * 0.20;              // magnetic pull toward cursor
            ty += dy * t * 0.20;
            tr += (dx / R) * t * 7;           // tilt as it reaches
            ts += t * 0.05;
          }
          over = Math.abs(dx) < b.hw && Math.abs(dy) < b.hh;
          if (over) { ts = 1.18; tr *= 0.35; } // landed on top → bigger
        }

        const s = st[i];
        s.x += (tx - s.x) * LERP;
        s.y += (ty - s.y) * LERP;
        s.s += (ts - s.s) * LERP;
        s.r += (tr - s.r) * LERP;
        el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.r}deg) scale(${s.s})`;
        el.style.zIndex = over ? '10' : '';
      });

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', measure);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
    // Re-init when the cards actually arrive (dbEvents loads after mount).
  }, [motion, cards.length]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[1] hidden lg:block" aria-hidden>
      {cards.slice(0, SLOTS.length).map((c, i) => {
        const s = SLOTS[i];
        return (
          <div key={i} data-depth={s.depth} className="absolute will-change-transform" style={{ ...s.style, width: s.w }}>
            <div
              className="animate-float rounded-xl border bg-card/65 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] backdrop-blur-md transition-shadow"
              style={{ borderColor: `hsl(${c.hue} / 0.35)`, animationDelay: s.delay }}
            >
              <span className="text-eyebrow font-semibold" style={{ color: `hsl(${c.hue})` }}>{c.category}</span>
              <p className="mt-2 line-clamp-2 font-display text-sm font-semibold leading-snug">{c.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
