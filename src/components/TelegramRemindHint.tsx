'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useAuth, useDb } from '@/supabase';
import { useSaved } from '@/context/SavedContext';
import { useLanguage } from '@/context/LanguageContext';
import { TelegramConnectButton } from '@/components/TelegramConnectButton';

/**
 * The "save → get reminded" bridge on the event page. Renders only for a
 * signed-in user who has SAVED this opportunity:
 *  - Telegram not connected → nudge card with a connect button
 *  - connected → a quiet promise that the 3d/1d reminder DMs will arrive
 * (The reminders cron already exists — this makes it visible.)
 */
export function TelegramRemindHint({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { isSaved } = useSaved();
  const { t } = useLanguage();
  const supabase = useDb();

  // undefined = still loading; null = signed-in but no Telegram linked
  const [chatId, setChatId] = useState<number | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  // Re-check on window focus so returning from the Telegram app flips the
  // card to its confirmed state without a reload.
  useEffect(() => {
    const onFocus = () => setVersion((v) => v + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setChatId(data?.telegram_chat_id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, supabase, version]);

  if (!user || !isSaved(eventId) || chatId === undefined) return null;

  if (chatId) {
    return (
      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        {t.remindArmed}
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold">
        <Bell className="h-4 w-4 text-accent" />
        {t.remindNudgeTitle}
      </p>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">{t.remindNudgeBody}</p>
      <TelegramConnectButton />
    </div>
  );
}
