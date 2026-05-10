/**
 * Uzbek decorative pattern borders
 * Replaces generic backgrounds with traditional Central Asian designs
 */

export function UzbekPatternBorderTop() {
  return (
    <svg
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      className="w-full h-auto"
      style={{ display: 'block' }}
    >
      {/* Navy background */}
      <rect width="1200" height="80" fill="currentColor" className="text-primary" />

      {/* Top floral border pattern - repeating */}
      <defs>
        <pattern id="topFloral" x="0" y="0" width="120" height="80" patternUnits="userSpaceOnUse">
          {/* Ornamental flourish */}
          <path
            d="M60,10 Q55,20 50,15 Q45,20 40,10 Q45,25 50,20 Q55,25 60,10"
            fill="white"
            opacity="0.9"
          />
          {/* Center crown element */}
          <path
            d="M60,15 L65,25 L60,30 L55,25 Z"
            fill="white"
            opacity="0.85"
          />
          {/* Bottom flourish */}
          <path
            d="M60,40 Q55,50 50,45 Q45,50 40,40 Q45,55 50,50 Q55,55 60,40"
            fill="white"
            opacity="0.8"
          />
          {/* Side decorative dots */}
          <circle cx="30" cy="25" r="2" fill="white" opacity="0.7" />
          <circle cx="90" cy="25" r="2" fill="white" opacity="0.7" />
        </pattern>
      </defs>

      <rect width="1200" height="80" fill="url(#topFloral)" />

      {/* Wave bottom edge */}
      <path
        d="M0,70 Q30,65 60,70 T120,70 T180,70 T240,70 T300,70 T360,70 T420,70 T480,70 T540,70 T600,70 T660,70 T720,70 T780,70 T840,70 T900,70 T960,70 T1020,70 T1080,70 T1140,70 T1200,70 L1200,80 L0,80 Z"
        fill="white"
        opacity="0.15"
      />
    </svg>
  );
}

export function UzbekPatternBorderMiddle() {
  return (
    <svg
      viewBox="0 0 1200 60"
      preserveAspectRatio="none"
      className="w-full h-auto"
      style={{ display: 'block' }}
    >
      <defs>
        <pattern id="middleFloral" x="0" y="0" width="150" height="60" patternUnits="userSpaceOnUse">
          {/* Leaf pair */}
          <path
            d="M50,15 Q45,25 50,35 Q55,25 50,15"
            fill="white"
            opacity="0.85"
          />
          <path
            d="M100,15 Q95,25 100,35 Q105,25 100,15"
            fill="white"
            opacity="0.85"
          />
          {/* Central flower */}
          <circle cx="75" cy="30" r="8" fill="white" opacity="0.9" />
          <circle cx="75" cy="20" r="3" fill="white" opacity="0.7" />
          <circle cx="75" cy="40" r="3" fill="white" opacity="0.7" />
          <circle cx="65" cy="30" r="3" fill="white" opacity="0.7" />
          <circle cx="85" cy="30" r="3" fill="white" opacity="0.7" />
          {/* Decorative scrolls */}
          <path d="M20,20 Q15,25 20,30" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M130,20 Q135,25 130,30" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
        </pattern>
      </defs>

      {/* Teal/turquoise background */}
      <rect width="1200" height="60" fill="currentColor" className="text-accent" />
      <rect width="1200" height="60" fill="url(#middleFloral)" />
    </svg>
  );
}

export function UzbekPatternBorderBottom() {
  return (
    <svg
      viewBox="0 0 1200 100"
      preserveAspectRatio="none"
      className="w-full h-auto"
      style={{ display: 'block' }}
    >
      <defs>
        <pattern id="bottomFloral" x="0" y="0" width="180" height="100" patternUnits="userSpaceOnUse">
          {/* Large decorative flower left */}
          <circle cx="40" cy="50" r="15" fill="white" opacity="0.85" />
          <circle cx="30" cy="40" r="5" fill="white" opacity="0.7" />
          <circle cx="50" cy="40" r="5" fill="white" opacity="0.7" />
          <circle cx="30" cy="60" r="5" fill="white" opacity="0.7" />
          <circle cx="50" cy="60" r="5" fill="white" opacity="0.7" />

          {/* Leaf flourishes */}
          <path d="M50,30 Q60,35 55,50" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
          <path d="M50,70 Q60,65 55,50" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
          <path d="M30,30 Q20,35 25,50" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
          <path d="M30,70 Q20,65 25,50" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />

          {/* Right side mirror */}
          <circle cx="140" cy="50" r="15" fill="white" opacity="0.85" />
          <circle cx="130" cy="40" r="5" fill="white" opacity="0.7" />
          <circle cx="150" cy="40" r="5" fill="white" opacity="0.7" />
          <circle cx="130" cy="60" r="5" fill="white" opacity="0.7" />
          <circle cx="150" cy="60" r="5" fill="white" opacity="0.7" />

          {/* Center geometric ornament */}
          <polygon
            points="90,40 100,45 90,50 80,45"
            fill="white"
            opacity="0.8"
          />
          <polygon
            points="90,60 100,55 90,50 80,55"
            fill="white"
            opacity="0.75"
          />
        </pattern>
      </defs>

      {/* Navy background */}
      <rect width="1200" height="100" fill="currentColor" className="text-primary" />
      <rect width="1200" height="100" fill="url(#bottomFloral)" />

      {/* Wavy top edge */}
      <path
        d="M0,20 Q30,15 60,20 T120,20 T180,20 T240,20 T300,20 T360,20 T420,20 T480,20 T540,20 T600,20 T660,20 T720,20 T780,20 T840,20 T900,20 T960,20 T1020,20 T1080,20 T1140,20 T1200,20 L1200,0 L0,0 Z"
        fill="white"
        opacity="0.1"
      />
    </svg>
  );
}

/**
 * Uzbek color palette for backgrounds
 */
export function UzbekBackgroundPattern() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      style={{ zIndex: 0 }}
    >
      <defs>
        <radialGradient id="uzGradient1" cx="20%" cy="20%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.03" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="uzGradient2" cx="80%" cy="80%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="800" fill="url(#uzGradient1)" />
      <rect width="1200" height="800" fill="url(#uzGradient2)" />

      {/* Subtle geometric pattern - no pink bubbles! */}
      <g opacity="0.04" fill="currentColor" className="text-primary">
        <circle cx="100" cy="150" r="40" />
        <circle cx="300" cy="400" r="50" />
        <circle cx="800" cy="200" r="35" />
        <circle cx="1000" cy="600" r="45" />
        <polygon points="150,500 200,550 100,550" />
        <polygon points="700,100 750,150 650,150" />
      </g>
    </svg>
  );
}
