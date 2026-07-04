'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { useMotion } from './MotionConfig';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  /** Rise distance in px. */
  y?: number;
  delay?: number;
  className?: string;
}

/**
 * Scroll-reveal: fades + rises in when it enters the viewport. The element is
 * hidden via CSS (`[data-reveal]`) ONLY under the full-motion tier, so on weak
 * devices / reduced-motion it renders immediately and this effect no-ops.
 * Stagger a list by passing incremental `delay` to each item.
 */
export function Reveal({ children, as, y = 26, delay = 0, className }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType;
  const ref = useRef<HTMLElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !ref.current) return;
    const el = ref.current;
    let ctx: gsap.Context | null = null;

    (async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { opacity: 0, y },
          {
            opacity: 1, y: 0, duration: 0.9, delay, ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        );
      });
    })();

    return () => ctx?.revert();
  }, [motion, y, delay]);

  return (
    <Tag ref={ref} data-reveal className={className}>
      {children}
    </Tag>
  );
}
