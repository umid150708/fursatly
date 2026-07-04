'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { useMotion } from './MotionConfig';

/**
 * A horizontal card rail that slides sideways as you scroll past it — the
 * "posts switch as you scroll" effect. On the motion tier the track is scrubbed
 * horizontally by GSAP ScrollTrigger; on weak devices / reduced-motion it
 * degrades to a normal touch-scrollable rail.
 */
export function ScrollRail({ children, className = '' }: { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !wrap.current || !track.current) return;
    const w = wrap.current;
    const tr = track.current;
    let ctx: gsap.Context | null = null;

    (async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        const distance = tr.scrollWidth - w.offsetWidth;
        if (distance <= 0) return; // fits — no need to scrub
        gsap.fromTo(
          tr,
          { x: 0 },
          {
            x: -distance,
            ease: 'none',
            scrollTrigger: {
              trigger: w,
              start: 'top 78%',
              end: 'bottom 22%',
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        );
      }, w);
    })();

    return () => ctx?.revert();
  }, [motion]);

  return (
    <div ref={wrap} className={`${motion ? 'overflow-hidden' : 'no-scrollbar overflow-x-auto'} ${className}`}>
      <div ref={track} className="flex w-max gap-5 md:gap-6">
        {children}
      </div>
    </div>
  );
}
