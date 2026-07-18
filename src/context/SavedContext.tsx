'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useDb } from '@/supabase';
import { useAuth } from '@/supabase/auth-provider';

interface SavedContextValue {
  /** Event ids the signed-in user has saved. Empty when signed out. */
  savedIds: ReadonlySet<string>;
  isSaved: (eventId: string) => boolean;
  /** Optimistic save/unsave. Resolves to an error message or null. */
  toggle: (eventId: string) => Promise<string | null>;
  /** Bumped after every successful toggle — lets the account page refetch its list. */
  version: number;
}

const SavedContext = createContext<SavedContextValue | null>(null);

/**
 * Loads the user's saved event ids ONCE per session (single query), so each
 * EventCard's bookmark state is a Set lookup, not a query per card.
 */
export function SavedProvider({ children }: { children: ReactNode }) {
  const supabase = useDb();
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    supabase
      .from('saved_opportunities')
      .select('event_id')
      .then(({ data }) => {
        if (!cancelled && data) setSavedIds(new Set(data.map((r) => r.event_id as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const isSaved = useCallback((eventId: string) => savedIds.has(eventId), [savedIds]);

  const toggle = useCallback(
    async (eventId: string): Promise<string | null> => {
      if (!user) return 'not_signed_in';
      const wasSaved = savedIds.has(eventId);

      // Optimistic flip
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(eventId);
        else next.add(eventId);
        return next;
      });

      const { error } = wasSaved
        ? await supabase
            .from('saved_opportunities')
            .delete()
            .eq('user_id', user.id)
            .eq('event_id', eventId)
        : await supabase
            .from('saved_opportunities')
            .insert({ user_id: user.id, event_id: eventId });

      if (error) {
        // Roll back
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
        return error.message;
      }
      setVersion((v) => v + 1);
      return null;
    },
    [supabase, user, savedIds],
  );

  return (
    <SavedContext.Provider value={{ savedIds, isSaved, toggle, version }}>
      {children}
    </SavedContext.Provider>
  );
}

/** Access saved-opportunity state. Throws outside the provider. */
export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within a SavedProvider');
  return ctx;
}
