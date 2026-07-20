import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { isUuid } from './event-path';

/**
 * Server-side event fetch shared by the event page, generateMetadata and the
 * OG image route. Public data only (anon key, RLS-readable) — no cookies, so
 * the page stays ISR-cacheable. Wrapped in React cache() so the three callers
 * on one request hit the database once.
 *
 * `failed: true` means a transient error (network/DB) — callers should fall
 * back to the client fetch rather than 404 a possibly-existing event.
 */
export const fetchEventByParam = cache(
  async (param: string): Promise<{ event: any | null; failed: boolean }> => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      const query = supabase.from('events').select('*');
      const { data, error } = await (
        isUuid(param) ? query.eq('id', param) : query.eq('research_data->>slug', param)
      ).maybeSingle();
      if (error) return { event: null, failed: true };
      return { event: data ?? null, failed: false };
    } catch {
      return { event: null, failed: true };
    }
  },
);
