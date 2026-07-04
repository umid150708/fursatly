'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

/** Returns the singleton browser Supabase client (public anon key, read-only use). */
export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return instance;
}
