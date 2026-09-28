'use client';

import { UserRound } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Nav entry point for accounts. Always links to /account — the middleware
 * bounces signed-out visitors to /auth?next=/account. Signed in, it shows the
 * avatar, or the reader's initial set in ink.
 */
export function AccountButton() {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();

  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);
  const initial = (
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''
  ).trim().charAt(0).toUpperCase();

  return (
    <a
      href="/account"
      aria-label={t.accountTitle}
      title={t.accountTitle}
      className={`grid h-10 w-10 place-items-center border border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        user ? 'bg-foreground text-background hover:bg-accent hover:text-accent-foreground' : 'hover:bg-foreground hover:text-background'
      }`}
    >
      {user && avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : user && initial ? (
        <span className="font-display text-lg font-black leading-none">{initial}</span>
      ) : (
        <UserRound className={`h-4 w-4 ${isLoading ? 'opacity-40' : ''}`} />
      )}
    </a>
  );
}
