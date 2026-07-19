'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';

/**
 * The reliable Telegram connect affordance: a real button we control (unlike
 * Telegram's login widget, which silently renders nothing when its remote
 * script is blocked or /setdomain mismatches). Mints a personal deep link via
 * /api/telegram/connect-link and opens it; the webhook completes the link when
 * the user taps "Start" in Telegram.
 */
export function TelegramConnectButton({ className = '' }: { className?: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/telegram/connect-link');
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'no url');
      window.open(data.url, '_blank', 'noopener,noreferrer');
      toast({ title: t.telegramConnectOpen });
    } catch {
      toast({ title: t.authErrorGeneric, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={connect}
      disabled={busy}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-5 text-sm font-semibold text-white transition-all hover:bg-[#229ED9] hover:shadow-lg disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {t.telegramConnectCta}
    </button>
  );
}
