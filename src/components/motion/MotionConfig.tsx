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
    const full = document.documentElement.dataset.motion === 'full';
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
