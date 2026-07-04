'use client';

/** Animated CSS mesh-gradient. Runs on every device — base layer + fallback
 *  for the WebGL shader. Styling lives in `.gradient-mesh` (globals.css). */
export function GradientHero({ className = '' }: { className?: string }) {
  return (
    <div className={`gradient-mesh absolute inset-0 ${className}`} aria-hidden />
  );
}
