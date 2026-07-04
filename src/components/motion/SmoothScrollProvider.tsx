'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { useMotion } from './MotionConfig';

/**
 * Lenis inertia smooth-scroll, wired to GSAP's ScrollTrigger, initialised ONLY
 * on capable devices (motion tier). Weak devices / reduced-motion keep native
 * scroll — zero overhead. Lenis defaults leave touch scrolling native, so this
 * stays light on phones.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion) return;
    let lenis: { raf: (t: number) => void; on: (e: string, cb: () => void) => void; destroy: () => void } | null = null;
    let tick: ((time: number) => void) | null = null;
    let cancelled = false;

    (async () => {
      const [{ default: Lenis }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({ smoothWheel: true, duration: 1.1 }) as any;
      lenis!.on('scroll', ScrollTrigger.update);
      tick = (time: number) => lenis!.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    })();

    return () => {
      cancelled = true;
      if (tick) gsap.ticker.remove(tick);
      if (lenis) lenis.destroy();
    };
  }, [motion]);

  return <>{children}</>;
}
