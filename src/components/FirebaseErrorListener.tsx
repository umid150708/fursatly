'use client';

import { useState, useEffect } from 'react';

// ─── Generic app-level error emitter ────────────────────────────────────────
// Kept as a standalone singleton so it can be imported anywhere without
// bringing in any database-specific dependency.

type Callback<T> = (data: T) => void;

function createEventEmitter<T extends Record<string, any>>() {
  const events: { [K in keyof T]?: Array<Callback<T[K]>> } = {};
  return {
    on<K extends keyof T>(name: K, cb: Callback<T[K]>) {
      if (!events[name]) events[name] = [];
      events[name]!.push(cb);
    },
    off<K extends keyof T>(name: K, cb: Callback<T[K]>) {
      events[name] = events[name]?.filter(c => c !== cb);
    },
    emit<K extends keyof T>(name: K, data: T[K]) {
      events[name]?.forEach(cb => cb(data));
    },
  };
}

export interface AppEvents {
  'db-error': Error;
}

export const appErrorEmitter = createEventEmitter<AppEvents>();

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * An invisible component that listens for globally emitted 'db-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 * (Previously named FirebaseErrorListener — kept in same file for backwards compat.)
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (err: Error) => setError(err);
    appErrorEmitter.on('db-error', handleError);
    return () => appErrorEmitter.off('db-error', handleError);
  }, []);

  if (error) throw error;
  return null;
}
