"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

export function SuzaniMedallion({ className = "h-32 w-32" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 200 200" 
      className={`fill-current ${className} opacity-10 animate-spin-slow`}
      style={{ animationDuration: '60s' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="10 5" />
      <g className="text-primary">
        <circle cx="100" cy="100" r="20" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <path 
            key={angle}
            d="M100 40 Q120 70 100 100 Q80 70 100 40" 
            transform={`rotate(${angle} 100 100)`}
          />
        ))}
      </g>
      <g className="text-secondary">
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(angle => (
          <circle 
            key={angle}
            cx="100" 
            cy="145" 
            r="8" 
            transform={`rotate(${angle} 100 100)`}
          />
        ))}
      </g>
    </svg>
  );
}

export function DoppiIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 75" 
      className={`${className} drop-shadow-lg`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        {/* Left Half: Traditional Female (Geometric Shape) */}
        <path 
          d="M50 10 L15 25 L15 65 L50 70 Z" 
          fill="#FFFFFF" 
          stroke="#E5E5E5"
          strokeWidth="0.5"
        />
        <circle cx="32" cy="38" r="4.5" fill="#DC2626" />
        <circle cx="32" cy="38" r="1.5" fill="#FDE047" />
        <path d="M25 45 Q32 55 40 45" stroke="#059669" strokeWidth="1.2" fill="none" />
        <circle cx="24" cy="55" r="2.5" fill="#DC2626" />
        <circle cx="42" cy="30" r="2" fill="#DC2626" />

        {/* Right Half: Traditional Male (Geometric Shape) */}
        <path 
          d="M50 10 L85 25 L85 65 L50 70 Z" 
          fill="#111111" 
        />
        <path 
          d="M60 30 C65 25 75 35 70 45 C65 50 60 40 60 30" 
          fill="#FFFFFF" 
          opacity="0.9"
        />
        <path 
          d="M68 50 C72 45 80 55 75 60 C70 65 65 55 68 50" 
          fill="#FFFFFF" 
          opacity="0.8"
        />
        <circle cx="78" cy="35" r="1.5" fill="#FFFFFF" opacity="0.6" />
        <circle cx="62" cy="58" r="1.2" fill="#FFFFFF" opacity="0.5" />
        
        <line x1="50" y1="10" x2="50" y2="70" stroke="#CCCCCC" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.6" />
      </g>
    </svg>
  );
}

export function UzbekMotif({ children, isLocal, className = "" }: { children: React.ReactNode, isLocal?: boolean, className?: string }) {
  const { locale, isMounted } = useLanguage();
  
  const showUzbekTheme = isMounted && locale === 'uz';
  const showBadge = isMounted && isLocal;

  return (
    <div className={`relative group ${className}`}>
      {/* Background patterns - only for Uzbek locale */}
      {showUzbekTheme && (
        <div className="absolute inset-0 uzbek-suzani-bg pointer-events-none opacity-50 -z-10 rounded-[2rem]" />
      )}
      
      {/* Decorative wrapper - simplified to match English mode layout */}
      <div className={cn(
        "relative h-full transition-all duration-500 bg-background rounded-[2rem] border border-primary/5 shadow-lg group-hover:shadow-xl overflow-hidden",
        showUzbekTheme && "bg-background/90 backdrop-blur-sm"
      )}>
        <div className="h-full flex flex-col p-0">
           <div className="flex-1">
             {children}
           </div>
        </div>
      </div>
      
      {/* Combined Doppi Badge - shows for local events in ALL languages */}
      {showBadge && (
        <div className="absolute -top-4 -right-4 bg-slate-900 rounded-full p-2 border-2 border-white shadow-2xl rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0 flex items-center justify-center z-20">
          <DoppiIcon className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}

export function AtrasHeader() {
  const { locale, isMounted } = useLanguage();
  if (!isMounted || locale !== 'uz') return null;

  return (
    <div className="w-full overflow-hidden" style={{ height: '72px', background: 'hsl(184 70% 28%)' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="72"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="uz-band" x="0" y="0" width="120" height="72" patternUnits="userSpaceOnUse">

            {/* ─ background: deep emerald-teal ─ */}
            <rect width="120" height="72" fill="hsl(184 70% 28%)"/>

            {/* ─ gold rule lines top & bottom ─ */}
            <line x1="0" y1="3"  x2="120" y2="3"  stroke="hsl(42 65% 60%)" strokeWidth="2"/>
            <line x1="0" y1="69" x2="120" y2="69" stroke="hsl(42 65% 60%)" strokeWidth="2"/>

            {/* ─ outer decorative dots along gold lines ─ */}
            <circle cx="20" cy="3"  r="2" fill="hsl(42 65% 60%)"/>
            <circle cx="60" cy="3"  r="2" fill="hsl(42 65% 60%)"/>
            <circle cx="100" cy="3" r="2" fill="hsl(42 65% 60%)"/>
            <circle cx="20" cy="69" r="2" fill="hsl(42 65% 60%)"/>
            <circle cx="60" cy="69" r="2" fill="hsl(42 65% 60%)"/>
            <circle cx="100" cy="69" r="2" fill="hsl(42 65% 60%)"/>

            {/* ─ main diamond frame ─ */}
            <polygon points="60,10 94,36 60,62 26,36"
              fill="hsl(184 70% 22%)" stroke="hsl(42 65% 60%)" strokeWidth="1.8"/>

            {/* ─ inner smaller diamond ─ */}
            <polygon points="60,20 80,36 60,52 40,36"
              fill="none" stroke="hsl(42 65% 60%)" strokeWidth="0.8" opacity="0.6"/>

            {/* ─ 8-petal flower ─ */}
            <ellipse cx="60" cy="22" rx="4.5" ry="8" fill="white" opacity="0.9" transform="rotate(0   60 36)"/>
            <ellipse cx="60" cy="22" rx="4.5" ry="8" fill="white" opacity="0.9" transform="rotate(45  60 36)"/>
            <ellipse cx="60" cy="22" rx="4.5" ry="8" fill="white" opacity="0.9" transform="rotate(90  60 36)"/>
            <ellipse cx="60" cy="22" rx="4.5" ry="8" fill="white" opacity="0.9" transform="rotate(135 60 36)"/>
            {/* flower center */}
            <circle cx="60" cy="36" r="6" fill="hsl(42 65% 60%)"/>
            <circle cx="60" cy="36" r="3" fill="hsl(184 70% 28%)"/>
            <circle cx="60" cy="36" r="1.5" fill="hsl(42 65% 60%)"/>

            {/* ─ side half-diamonds (tile join) ─ */}
            <polygon points="0,36 14,24 14,48"   fill="hsl(184 70% 22%)" stroke="hsl(42 65% 60%)" strokeWidth="1"/>
            <polygon points="120,36 106,24 106,48" fill="hsl(184 70% 22%)" stroke="hsl(42 65% 60%)" strokeWidth="1"/>

            {/* ─ small 4-petal buds in half-diamonds ─ */}
            <ellipse cx="7" cy="30" rx="2.5" ry="4.5" fill="white" opacity="0.8" transform="rotate(0  7 36)"/>
            <ellipse cx="7" cy="30" rx="2.5" ry="4.5" fill="white" opacity="0.8" transform="rotate(90 7 36)"/>
            <circle  cx="7" cy="36" r="2.5" fill="hsl(42 65% 60%)"/>
            <ellipse cx="113" cy="30" rx="2.5" ry="4.5" fill="white" opacity="0.8" transform="rotate(0  113 36)"/>
            <ellipse cx="113" cy="30" rx="2.5" ry="4.5" fill="white" opacity="0.8" transform="rotate(90 113 36)"/>
            <circle  cx="113" cy="36" r="2.5" fill="hsl(42 65% 60%)"/>

            {/* ─ connecting vine between diamonds ─ */}
            <path d="M14,36 Q20,26 26,36" stroke="hsl(42 65% 60%)" strokeWidth="1" fill="none" opacity="0.5"/>
            <path d="M94,36 Q100,26 106,36" stroke="hsl(42 65% 60%)" strokeWidth="1" fill="none" opacity="0.5"/>

          </pattern>
        </defs>
        <rect width="100%" height="72" fill="url(#uz-band)"/>
      </svg>
    </div>
  );
}
