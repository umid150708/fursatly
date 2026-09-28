'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useSaved } from '@/context/SavedContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface SaveButtonProps {
  eventId: string;
  /** Compact icon-only style for cards; larger labeled style for the detail page. */
  size?: 'sm' | 'lg';
}

/**
 * Bookmark toggle. Signed-out clicks route to /auth. Optimistic — the
 * SavedContext flips instantly and rolls back (with a toast) on failure.
 */
export function SaveButton({ eventId, size = 'sm' }: SaveButtonProps) {
  const { user } = useAuth();
  const { isSaved, toggle } = useSaved();
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const saved = isSaved(eventId);

  const handleClick = async (e: MouseEvent) => {
    // Cards navigate on click — the bookmark must not.
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast({ title: t.signInToSave });
      router.push('/auth');
      return;
    }
    if (busy) return;
    setBusy(true);
    const error = await toggle(eventId);
    setBusy(false);
    if (error) {
      toast({ title: t.authErrorGeneric, description: error, variant: 'destructive' });
    }
  };

  if (size === 'lg') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={saved}
        aria-label={saved ? t.unsaveOpp : t.saveOpp}
        className={`font-label inline-flex h-11 items-center gap-2 border border-foreground px-5 text-sm font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          saved ? 'bg-foreground text-background' : 'hover:bg-foreground hover:text-background'
        }`}
      >
        <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
        {saved ? t.unsaveOpp : t.saveOpp}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? t.unsaveOpp : t.saveOpp}
      className={`-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        saved ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
    </button>
  );
}
