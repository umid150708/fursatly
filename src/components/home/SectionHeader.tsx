'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useMotion } from '@/components/motion/MotionConfig';

/**
 * Section header in the reference site's architectural pattern — a top row of
 * `( label )  ·  subtitle  ·  — 0X`, a full-width hairline that draws itself
 * left→right, then the big display title. Keeps Fursatly's brand (teal accent,
 * Space Grotesk display) while adopting the motion. Motion-gated like Reveal:
 * static, no JS, on the reduced-motion tier.
 */
export function SectionHeader({
  label,
  index,
  title,
  subtitle,
  className = '',
  titleClassName = '',
}: {
  label: string;
  index: string;
  title: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !root.current) return;
    const el = root.current;
    let ctx: gsap.Context | null = null;

    (async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context((self) => {
        const q = (s: string) => self.selector!(s);
        gsap
          .timeline({ defaults: { ease: 'expo.out' }, scrollTrigger: { trigger: el, start: 'top 82%', once: true } })
          .fromTo(q('[data-h="row"]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 })
          .fromTo(q('[data-h="rule"]'), { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, '-=0.3')
          .fromTo(q('[data-h="title"]'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.6');
      }, el);
    })();

    return () => ctx?.revert();
  }, [motion]);

  return (
    <div ref={root} className={className}>
      <div data-h="row" className="flex items-baseline justify-between gap-4">
        <span className="text-eyebrow text-accent">( {label} )</span>
        {subtitle && <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{subtitle}</span>}
        <span className="text-eyebrow tabular-nums text-muted-foreground">— {index}</span>
      </div>
      <span data-h="rule" className="mt-4 block h-px w-full origin-left bg-border" aria-hidden />
      <h2 data-h="title" className={`text-display mt-8 font-display font-semibold ${titleClassName}`}>{title}</h2>
    </div>
  );
}
