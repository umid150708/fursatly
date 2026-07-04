'use client';

import { useEffect, useRef, type ReactNode, type ElementType } from 'react';
import { gsap } from 'gsap';
import { useMotion } from './MotionConfig';

/**
 * Drifts its content vertically as it scrolls through the viewport (scrubbed),
 * for that "everything moves" feel. No-op on weak devices / reduced-motion.
 * Don't wrap a <Reveal> child — both animate transforms and would fight.
 */
export function Parallax({
  children, speed = 50, as, className,
}: { children: ReactNode; speed?: number; as?: ElementType; className?: string }) {
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
          { y: speed },
          { y: -speed, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.5 } },
        );
      });
    })();
    return () => ctx?.revert();
  }, [motion, speed]);

  return <Tag ref={ref} className={className}>{children}</Tag>;
}
