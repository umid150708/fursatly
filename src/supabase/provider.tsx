'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useEffect,
  DependencyList,
} from 'react';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SupabaseProviderProps {
  children: ReactNode;
}

export interface SupabaseContextState {
  areServicesAvailable: boolean;
  supabase: SupabaseClient | null;
  user: User | null;
  session: Session | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface SupabaseServicesAndUser {
  supabase: SupabaseClient;
  user: User | null;
  session: Session | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const SupabaseContext = createContext<SupabaseContextState | undefined>(undefined);

/**
 * SupabaseProvider manages the Supabase client and auth session state.
 * Drop-in replacement for the old FirebaseProvider.
 */
export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    // Hydrate existing session on mount
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setUserError(error);
      } else {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setIsUserLoading(false);
    });

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsUserLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const contextValue = useMemo((): SupabaseContextState => ({
    areServicesAvailable: !!supabase,
    supabase,
    user,
    session,
    isUserLoading,
    userError,
  }), [supabase, user, session, isUserLoading, userError]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hooks  (mirrors the old useFirebase / useFirestore / useAuth / useUser API)
// ─────────────────────────────────────────────────────────────────────────────

export const useSupabase = (): SupabaseServicesAndUser => {
  const context = useContext(SupabaseContext);

  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider.');
  }

  if (!context.areServicesAvailable || !context.supabase) {
    throw new Error('Supabase client not available. Check SupabaseProvider setup.');
  }

  return {
    supabase: context.supabase,
    user: context.user,
    session: context.session,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access the Supabase client — replaces useFirestore() */
export const useDb = (): SupabaseClient => {
  const { supabase } = useSupabase();
  return supabase;
};

/** Hook to access Supabase auth — replaces useAuth() */
export const useAuth = () => {
  const { supabase } = useSupabase();
  return supabase.auth;
};

/** Hook to access the current session */
export const useSession = (): Session | null => {
  const { session } = useSupabase();
  return session;
};

/** Hook to access the authenticated user — replaces useUser() */
export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useSupabase();
  return { user, isUserLoading, userError };
};

/**
 * Utility to mark a value as memoized — replaces useMemoFirebase().
 * Supabase queries are plain objects/strings so this is a lightweight passthrough.
 */
type Memo<T> = T & { __memo?: boolean };

export function useMemoSupabase<T>(factory: () => T, deps: DependencyList): Memo<T> {
  const memoized = useMemo(factory, deps);
  if (typeof memoized !== 'object' || memoized === null) return memoized as Memo<T>;
  (memoized as Memo<T>).__memo = true;
  return memoized as Memo<T>;
}
