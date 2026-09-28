'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export interface MotionTier {
  /** Drifting clippings on the front page, and Lenis smooth-scroll. */
  motion: boolean;
}

const MotionContext = createContext<MotionTier>({ motion: false });

/**
 * The motion tier: single source of truth for "how much wow can this device
 * afford". SSR-safe: starts off, upgrades after mount.
 */
export function MotionConfigProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<MotionTier>({ motion: false });

  useEffect(() => {
    // Derived after mount rather than read from an attribute on <html>: React
    // 19's production hydration strips <html> attributes it did not render,
    // which once silently disabled every animation (floating cards, Lenis).
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const save = !!(navigator as any).connection?.saveData;
    const full = !reduce && !save;
    setTier({ motion: full });
  }, []);

  return <MotionContext.Provider value={tier}>{children}</MotionContext.Provider>;
}

export const useMotion = () => useContext(MotionContext);
