'use client';

import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useMotion } from '@/components/motion/MotionConfig';

export interface PillOption {
  id: string | null;
  label: string;
  icon?: boolean;
}

/**
 * Category filter pills with a shared-layout active indicator (Motion's
 * `layoutId`): the highlight physically glides from the old pill to the new one
 * instead of snapping colours. Gated behind the motion tier — reduced-motion
 * users get an instant swap. Self-contained; no GSAP interaction.
 */
export function CategoryPills({
  options,
  active,
  onChange,
}: {
  options: PillOption[];
  active: string | null;
  onChange: (id: string | null) => void;
}) {
  const { motion: motionOn } = useMotion();

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {options.map((o) => {
        const isActive = active === o.id;
        return (
          <button
            key={o.id ?? 'all'}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={isActive}
            className={`relative inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
              isActive
                ? 'border-foreground text-background'
                : 'border-border text-foreground hover:border-foreground/40'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="category-pill-active"
                className="absolute inset-0 rounded-lg bg-foreground"
                transition={
                  motionOn
                    ? { type: 'spring', stiffness: 380, damping: 32 }
                    : { duration: 0 }
                }
              />
            )}
            {o.icon && <Sparkles className="relative z-10 h-4 w-4" aria-hidden />}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
