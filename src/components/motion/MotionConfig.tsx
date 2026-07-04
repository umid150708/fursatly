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
    setTier({ motion: full, webgl: full && !coarse });
  }, []);

  return <MotionContext.Provider value={tier}>{children}</MotionContext.Provider>;
}

export const useMotion = () => useContext(MotionContext);
