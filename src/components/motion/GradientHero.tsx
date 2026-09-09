'use client';

/** Animated CSS mesh-gradient. Runs on every device — base layer + fallback
 *  for the WebGL shader. Styling lives in `.gradient-mesh` (globals.css).
 *
 *  Three layers rather than one stacked background: the drift used to animate
 *  `background-position`, which the compositor cannot handle, so it repainted
 *  the whole hero every frame for as long as it was on screen. One layer per
 *  bloom lets the same motion run as a `transform`, on the GPU. The keyframes
 *  are the old background-position values converted 1:1 — the animation looks
 *  exactly as it did. */
export function GradientHero({ className = '' }: { className?: string }) {
  return (
    <div className={`gradient-mesh absolute inset-0 ${className}`} aria-hidden>
      <div className="mesh-layer mesh-a" />
      <div className="mesh-layer mesh-b" />
      <div className="mesh-layer mesh-c" />
    </div>
  );
}
