// Central barrel for the Supabase integration layer.
// Mirrors the old src/firebase/index.ts exports so consumers only need to update import paths.

export { getSupabaseClient } from './client';
export { SupabaseClientProvider } from './client-provider';
export * from './provider';
export * from './use-collection';
export * from './use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
