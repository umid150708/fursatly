'use client';

import { useEffect, useRef } from 'react';
import { useMotion } from '@/components/motion/MotionConfig';

export interface FloatCard {
  title: string;
  category: string;
  hue: string; // bare HSL triple
}

// Scatter slots — kept to the top + right so they orbit the left-aligned
// headline without covering it or the search. Each has a parallax depth + delay.
const SLOTS = [
  { style: { top: '13%', right: '1%'  }, depth: 1.10, w: 228, delay: '0s'   },
  { style: { top: '11%', right: '29%' }, depth: 0.70, w: 176, delay: '1.3s' },
  { style: { top: '40%', right: '4%'  }, depth: 0.55, w: 238, delay: '0.5s' },
  { style: { top: '33%', right: '23%' }, depth: 1.35, w: 168, delay: '1.0s' },
  { style: { top: '66%', right: '3%'  }, depth: 1.00, w: 200, delay: '1.9s' },
  { style: { top: '60%', right: '27%' }, depth: 0.85, w: 182, delay: '0.9s' },
] as const;

/**
 * Category cards scattered around the hero that drift with the cursor (parallax
 * by depth) and gently float — inspired by the reference. Decorative
 * (pointer-events-none), desktop-only, and disabled under reduced motion.
 */
export function FloatingCards({ cards }: { cards: FloatCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>('[data-depth]'));
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    const loop = () => {
      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      for (const it of items) {
        const d = parseFloat(it.dataset.depth || '1');
        it.style.transform = `translate3d(${cx * d * -46}px, ${cy * d * -34}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, [motion]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[1] hidden lg:block" aria-hidden>
      {cards.slice(0, SLOTS.length).map((c, i) => {
        const s = SLOTS[i];
        return (
          <div key={i} data-depth={s.depth} className="absolute will-change-transform" style={{ ...s.style, width: s.w }}>
            <div
              className="animate-float rounded-xl border bg-card/65 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] backdrop-blur-md"
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
