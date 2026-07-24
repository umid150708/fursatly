'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export interface MotionTier {
  /** Scroll-reveals, smooth-scroll, headline splits. */
  motion: boolean;
  /** WebGL shader hero (heaviest — capable device + fine pointer only). */
  webgl: boolean;
}

const MotionContext = createContext<MotionTier>({ motion: false, webgl: false });

/**
 * Reads the motion tier decided pre-paint by the inline probe in layout.tsx
 * (`documentElement.dataset.motion`). Single source of truth for "how much
 * wow can this device afford". SSR-safe: starts off, upgrades after mount.
 */
export function MotionConfigProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<MotionTier>({ motion: false, webgl: false });

  useEffect(() => {
    // Re-derive the tier here instead of trusting the pre-paint probe's
    // data-motion attribute: React 19's PRODUCTION hydration reconciles the
    // <html> element and strips attributes it didn't render — the probe's flag
    // survived in dev but vanished on prod, silently disabling every animation
    // (floating cards, reveals, Lenis). Same duplicate-assert pattern as the
    // theme class. The probe still matters: it gates [data-reveal] CSS before
    // hydration so there's no FOUC.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const save = !!(navigator as any).connection?.saveData;
    const full = !reduce && !save;
    document.documentElement.dataset.motion = full ? 'full' : 'reduced'; // re-assert for CSS gating
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const mem = (navigator as any).deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    // Lightweight motion runs whenever the tier is full; the heavy WebGL shader
    // stays gated to capable, fine-pointer (desktop-class) devices.
    setTier({ motion: full, webgl: full && !coarse && mem >= 4 && cores >= 4 });
  }, []);

  return <MotionContext.Provider value={tier}>{children}</MotionContext.Provider>;
}

export const useMotion = () => useContext(MotionContext);
