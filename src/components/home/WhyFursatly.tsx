'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useMotion } from '@/components/motion/MotionConfig';

interface Feat {
  title: string;
  desc: string;
}

/**
 * "Why Fursatly" — an architectural, self-drawing diagram in the spirit of a
 * process blueprint: thin concentric circles and a horizontal timeline axis
 * stroke themselves in, square nodes pop onto the axis, and the heading + four
 * numbered blocks rise into place — all choreographed on scroll.
 *
 * The draw is pure SVG stroke-dashoffset + CSS scaleX, orchestrated by one GSAP
 * timeline. Everything renders fully visible by default; the animation only runs
 * on the full-motion tier, so reduced-motion / weak devices get the static
 * diagram with no JS. The section sits well below the fold, so setting the
 * "from" states in the effect never flashes.
 */
export function WhyFursatly({ lead, title, feats }: { lead: string; title: string; feats: Feat[] }) {
  const root = useRef<HTMLElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !root.current) return;
    const el = root.current;
    let ctx: gsap.Context | null = null;

    (async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context((self) => {
        const q = (sel: string) => self.selector!(sel);
        const tl = gsap.timeline({
          defaults: { ease: 'expo.out' },
          scrollTrigger: { trigger: el, start: 'top 72%', once: true },
        });
        tl.fromTo(q('[data-anim="eyebrow"]'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 })
          .fromTo(q('[data-anim="title"]'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.4')
          .fromTo(q('[data-anim="underline"]'), { scaleX: 0 }, { scaleX: 1, duration: 0.7 }, '-=0.45')
          .fromTo(q('[data-anim="circle"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.7, stagger: 0.18, ease: 'power2.inOut' }, '-=0.5')
          .fromTo(q('[data-anim="track"]'), { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'power2.inOut' }, '<')
          .fromTo(q('[data-anim="node"]'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.12, ease: 'back.out(2)' }, '-=0.7')
          .fromTo(q('[data-anim="block"]'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, '-=0.45');
      }, el);
    })();

    return () => ctx?.revert();
  }, [motion]);

  // Node centres for a 4-column axis (centre of each column).
  const nodes = [12.5, 37.5, 62.5, 87.5];

  return (
    <section ref={root} className="container relative overflow-hidden py-24 md:py-32">
      {/* Decorative concentric circles — drawn hairlines, offset to the right. */}
      <svg
        className="pointer-events-none absolute -right-24 top-1/2 hidden h-[640px] w-[640px] -translate-y-1/2 text-foreground/15 md:block"
        viewBox="0 0 320 320"
        fill="none"
        aria-hidden
      >
        {[70, 110, 150].map((r) => (
          <circle
            key={r}
            data-anim="circle"
            cx="160"
            cy="160"
            r={r}
            pathLength={1}
            strokeDasharray={1}
            stroke="currentColor"
            strokeWidth={0.6}
          />
        ))}
      </svg>

      <div className="relative">
        <p data-anim="eyebrow" className="text-eyebrow text-accent">{lead}</p>
        <h2 data-anim="title" className="text-display mt-4 font-display font-semibold">{title}</h2>
        <span data-anim="underline" className="mt-6 block h-px w-24 origin-left bg-accent" aria-hidden />
      </div>

      <div className="relative mt-16">
        {/* Timeline axis — draws left→right with a square node above each block. */}
        <div className="relative mb-8 hidden h-3 lg:block" aria-hidden>
          <span data-anim="track" className="absolute inset-x-0 top-1/2 block h-px origin-left -translate-y-1/2 bg-foreground/25" />
          {nodes.map((left) => (
            <span
              key={left}
              data-anim="node"
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-foreground/50 bg-background"
              style={{ left: `${left}%` }}
            />
          ))}
        </div>

        {/* Feature blocks */}
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {feats.map((f, i) => (
            <div key={i} className="bg-background p-8">
              <div data-anim="block">
                <span className="text-eyebrow font-semibold text-accent">0{i + 1}</span>
                <h3 className="mt-6 font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
