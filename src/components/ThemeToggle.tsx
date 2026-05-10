"use client";

import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="h-10 w-10 rounded-xl border-primary/20 hover:bg-primary/5 transition-all"
    >
      {theme === 'dark'
        ? <Sun  className="h-4 w-4 text-amber-400" />
        : <Moon className="h-4 w-4 text-primary" />
      }
    </Button>
  );
}
