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
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
          saved
            ? 'border-gold/60 bg-gold/10 text-gold'
            : 'border-border text-muted-foreground hover:border-gold/40 hover:text-foreground'
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
      className={`grid h-8 w-8 place-items-center rounded-lg transition-all ${
        saved
          ? 'text-gold'
          : 'text-muted-foreground/60 hover:bg-secondary hover:text-foreground'
      }`}
    >
      <Bookmark className={`h-4 w-4 transition-transform ${saved ? 'scale-110 fill-current' : ''}`} />
    </button>
  );
}
