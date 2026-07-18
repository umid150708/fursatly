'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

/**
 * Returns the singleton browser Supabase client.
 *
 * Cookie-based (@supabase/ssr) so the session is readable by middleware,
 * server components (/account gate) and future server routes (chatbot),
 * not just the browser.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    instance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return instance;
}
