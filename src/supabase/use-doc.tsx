'use client';

import { useState, useEffect, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * React hook to fetch and subscribe to a single Supabase row in real-time.
 * Mirrors the old useDoc() from Firestore.
 *
 * @param supabase  – The Supabase client instance.
 * @param table     – The table name.
 * @param id        – The row primary key (id). Pass null to skip fetching.
 */
export function useDoc<T = any>(
  supabase: SupabaseClient | null,
  table: string,
  id: string | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDoc = useMemo(() => async () => {
    if (!supabase || !id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data: row, error: queryError } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (queryError) {
      setError(new Error(queryError.message));
      setData(null);
    } else {
      setData(row as WithId<T>);
    }
    setIsLoading(false);
  }, [supabase, table, id]);

  // Initial fetch
  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  // Realtime subscription for this specific row
  useEffect(() => {
    if (!supabase || !id) return;

    const channel = `${table}:id=eq.${id}`;
    const subscription = supabase
      .channel(channel)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `id=eq.${id}` },
        () => { fetchDoc(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [supabase, table, id, fetchDoc]);

  return { data, isLoading, error };
}
