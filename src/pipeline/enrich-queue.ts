/**
 * The enrich cron's queue: listings still waiting for their first enrichment.
 *
 * Retired duplicates and listings that failed MAX_ATTEMPTS times also sit in
 * the table as inactive rows. Filtering them out after a small oldest-first
 * LIMIT starved the queue: the six oldest inactive rows were all skippable, so
 * the cron answered "Nothing to do" while new listings waited behind them.
 * Filtering happens in SQL, before the limit.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_ATTEMPTS = 3;

export function enrichQueueQuery(supabase: SupabaseClient, limit: number) {
  return supabase
    .from('events')
    .select('id, title, research_data')
    .eq('is_active', false)
    .is('research_data->>duplicate_of', null)
    .or(`research_data->_attempts.is.null,research_data->_attempts.lt.${MAX_ATTEMPTS}`)
    .order('created_at', { ascending: true })
    .limit(limit);
}
