"use client";

import { useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);
  const isDark = theme === 'dark';

  const handle = () => {
    const btn = ref.current;
    const supports = typeof (document as any).startViewTransition === 'function';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!btn || !supports || reduce) { toggleTheme(); return; }

    // Circular reveal of the new theme, expanding from the toggle button.
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = (document as any).startViewTransition(() => toggleTheme());
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 950, easing: 'cubic-bezier(0.16,1,0.3,1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  };

  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      onClick={handle}
      aria-label="Toggle theme"
      className="h-10 w-10 rounded-xl border-border transition-colors hover:bg-secondary"
    >
      <span className="relative block h-4 w-4">
        <Sun className={`absolute inset-0 h-4 w-4 text-gold transition-all duration-700 ${isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
        <Moon className={`absolute inset-0 h-4 w-4 text-foreground transition-all duration-700 ${isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
      </span>
    </Button>
  );
}
