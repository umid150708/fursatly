'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useDb } from './provider';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** True until the initial session read completes — gate UI on this to avoid flicker. */
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  /** Completes a Telegram login: exchanges the server-minted token_hash for a session. */
  verifyTokenHash: (tokenHash: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const callbackUrl = (next = '/account') =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useDb();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial read + subscribe. onAuthStateChange also fires INITIAL_SESSION,
    // but an explicit getSession() keeps us correct across library versions.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      // With email confirmation ON, a session is absent until the link is clicked.
      return { error: error?.message ?? null, needsConfirm: !error && !data.session };
    },
    [supabase],
  );

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl() },
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const verifyTokenHash = useCallback(
    async (tokenHash: string) => {
      const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        isLoading,
        signInWithPassword,
        signUpWithPassword,
        signInWithMagicLink,
        signInWithGoogle,
        verifyTokenHash,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Access auth state + methods. Throws outside the provider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
