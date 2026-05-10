'use client';

import React, { useMemo, type ReactNode } from 'react';
import { SupabaseProvider } from './provider';

interface SupabaseClientProviderProps {
  children: ReactNode;
}

/**
 * Client-side wrapper that boots the SupabaseProvider.
 * Drop-in replacement for the old FirebaseClientProvider.
 */
export function SupabaseClientProvider({ children }: SupabaseClientProviderProps) {
  return (
    <SupabaseProvider>
      {children}
    </SupabaseProvider>
  );
}
