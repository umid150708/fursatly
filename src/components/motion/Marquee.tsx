'use client';

import { type ReactNode } from 'react';

/** Infinite horizontal marquee. Renders the items twice for a seamless loop;
 *  pauses on hover, freezes under reduced-motion (see `.animate-marquee`). */
export function Marquee({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="flex w-max animate-marquee">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0" aria-hidden={dup === 1}>
            {items.map((item, i) => (
              <span key={i} className="flex items-center">{item}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
