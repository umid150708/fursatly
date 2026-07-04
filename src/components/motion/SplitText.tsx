'use client';

import type { CSSProperties } from 'react';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
}

/**
 * Kinetic headline: each word is clipped and lifts into place in sequence.
 * Pure CSS (see `.split-line` in globals.css) — the reveal only runs under the
 * full-motion tier, so weak devices / reduced-motion just show the text.
 */
export function SplitText({ text, className, delay = 0 }: SplitTextProps) {
  const words = text.split(' ');
  return (
    <span
      className={className}
      aria-label={text}
      style={{ ['--split-delay' as any]: `${delay}s` } as CSSProperties}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]" aria-hidden>
          <span
            className="split-line inline-block will-change-transform"
            style={{ ['--i' as any]: i } as CSSProperties}
          >
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </span>
  );
}
