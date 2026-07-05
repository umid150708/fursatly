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
