'use client';

import { UserRound } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';

/**
 * Nav entry point for accounts. Always links to /account — the middleware
 * bounces signed-out visitors to /auth?next=/account. Shows the avatar (or
 * an accent ring) once signed in.
 */
export function AccountButton() {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();

  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      aria-label={t.accountTitle}
      className={`h-10 w-10 rounded-xl border-border transition-colors hover:bg-secondary ${
        user ? 'ring-1 ring-accent/50' : ''
      }`}
    >
      <a href="/account">
        {user && avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-5 w-5 rounded-md object-cover" />
        ) : (
          <UserRound
            className={`h-4 w-4 ${user ? 'text-accent' : 'text-foreground'} ${
              isLoading ? 'opacity-40' : ''
            }`}
          />
        )}
      </a>
    </Button>
  );
}
