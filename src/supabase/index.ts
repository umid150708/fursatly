// Supabase integration layer — public barrel.
export { getSupabaseClient } from './client';
export { SupabaseClientProvider, useDb } from './provider';
export { useCollection } from './use-collection';
export type { WithId, UseCollectionResult } from './use-collection';
