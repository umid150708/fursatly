/**
 * The doppi (Uzbek skullcap) brand emblem — two halves, one traditional
 * "female" patterned side and one "male" side, split by a dashed seam.
 * Used as the logo mark in the site nav.
 */
export function DoppiIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 75" className={`${className} drop-shadow-lg`} xmlns="http://www.w3.org/2000/svg">
      <g>
        {/* Left half: traditional female (geometric shape) */}
        <path d="M50 10 L15 25 L15 65 L50 70 Z" fill="#FFFFFF" stroke="#E5E5E5" strokeWidth="0.5" />
        <circle cx="32" cy="38" r="4.5" fill="#DC2626" />
        <circle cx="32" cy="38" r="1.5" fill="#FDE047" />
        <path d="M25 45 Q32 55 40 45" stroke="#059669" strokeWidth="1.2" fill="none" />
        <circle cx="24" cy="55" r="2.5" fill="#DC2626" />
        <circle cx="42" cy="30" r="2" fill="#DC2626" />

        {/* Right half: traditional male (geometric shape) */}
        <path d="M50 10 L85 25 L85 65 L50 70 Z" fill="#111111" />
        <path d="M60 30 C65 25 75 35 70 45 C65 50 60 40 60 30" fill="#FFFFFF" opacity="0.9" />
        <path d="M68 50 C72 45 80 55 75 60 C70 65 65 55 68 50" fill="#FFFFFF" opacity="0.8" />
        <circle cx="78" cy="35" r="1.5" fill="#FFFFFF" opacity="0.6" />
        <circle cx="62" cy="58" r="1.2" fill="#FFFFFF" opacity="0.5" />

        <line x1="50" y1="10" x2="50" y2="70" stroke="#CCCCCC" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.6" />
      </g>
    </svg>
  );
}
