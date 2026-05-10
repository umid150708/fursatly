'use client';

import { SupabaseClient } from '@supabase/supabase-js';

/** Initiate an anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(supabase: SupabaseClient): void {
  supabase.auth.signInAnonymously().catch((error) => {
    console.error('[Supabase] Anonymous sign-in failed:', error.message);
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(supabase: SupabaseClient, email: string, password: string): void {
  supabase.auth.signUp({ email, password }).catch((error) => {
    console.error('[Supabase] Sign-up failed:', error.message);
  });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(supabase: SupabaseClient, email: string, password: string): void {
  supabase.auth.signInWithPassword({ email, password }).catch((error) => {
    console.error('[Supabase] Sign-in failed:', error.message);
  });
}
