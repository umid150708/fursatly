// Supabase integration layer — public barrel.
export { getSupabaseClient } from './client';
export { SupabaseClientProvider, useDb } from './provider';
export { AuthProvider, useAuth } from './auth-provider';
export { useCollection } from './use-collection';
export type { WithId, UseCollectionResult } from './use-collection';
