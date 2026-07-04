'use client';

import dynamic from 'next/dynamic';
import { useMotion } from './MotionConfig';
import { useTheme } from '@/context/ThemeContext';
import { GradientHero } from './GradientHero';

const ShaderHero = dynamic(() => import('./ShaderHero'), { ssr: false });

/** Hero backdrop: theme-correct CSS mesh-gradient on every device, with
 *  translucent WebGL accent blooms layered on top only on the WebGL tier. */
export function HeroBackground() {
  const { webgl } = useMotion();
  const { isDark } = useTheme();

  // Teal bloom — a touch brighter on dark so it reads over the ink background.
  const accent: [number, number, number] = isDark ? [0.12, 0.55, 0.58] : [0.06, 0.43, 0.47];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <GradientHero />
      {webgl && (
        <div className="absolute inset-0 animate-[fadein_1.4s_ease-out]">
          <ShaderHero accent={accent} />
        </div>
      )}
    </div>
  );
}
