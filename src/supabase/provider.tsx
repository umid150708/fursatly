'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

const SupabaseContext = createContext<SupabaseClient | null>(null);

/** Provides the singleton Supabase client to the React tree. */
export function SupabaseClientProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>;
}

/** Access the Supabase client. Throws if used outside the provider. */
export function useDb(): SupabaseClient {
  const supabase = useContext(SupabaseContext);
  if (!supabase) throw new Error('useDb must be used within a SupabaseClientProvider');
  return supabase;
}
