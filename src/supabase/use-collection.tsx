'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

type AwaitableLike<T> = PromiseLike<{ data: T[] | null; error: any }>;

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches a Supabase query and refreshes every 5 minutes via polling.
 *
 * Realtime subscription was removed — it made every connected browser
 * re-fetch ALL events on each pipeline enrich cycle, exhausting Supabase's
 * connection limit. Polling keeps data fresh at a safe, predictable cost.
 *
 * IMPORTANT: Pass a stable (memoized) queryFn via useCallback to avoid
 * infinite re-fetch loops.
 *
 * `initialData` (optional) seeds the state from a server-rendered payload so
 * the first paint shows content instead of a spinner. The very first client
 * fetch is skipped — the server just delivered the same rows — but re-fetches
 * from a CHANGED queryFn (e.g. a category filter) and the 5-minute poll still
 * run as before.
 */
export function useCollection<T = any>(
  supabase: SupabaseClient | null,
  queryFn: (() => AwaitableLike<T>) | null,
  initialData?: WithId<T>[] | null,
): UseCollectionResult<T> {
  const [data, setData]       = useState<WithId<T>[] | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData); // spinner only when there's nothing to show yet
  const [error, setError]     = useState<Error | null>(null);
  const skipFirstFetch = useRef(Boolean(initialData));

  const fetchData = useCallback(async () => {
    if (!supabase || !queryFn) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data: rows, error: queryError } = await queryFn();
    if (queryError) {
      setError(new Error(queryError.message));
      setData(null);
    } else {
      setData((rows ?? []) as WithId<T>[]);
    }
    setIsLoading(false);
  }, [supabase, queryFn]);

  // Initial fetch — skipped once when server-rendered initialData already
  // holds these rows; later queryFn changes (filters) fetch as normal.
  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    fetchData();
  }, [fetchData]);

  // Poll every 5 minutes — keeps data fresh without Realtime WebSocket overhead
  useEffect(() => {
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, isLoading, error };
}
