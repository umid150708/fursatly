'use client';

import { useEffect, useRef } from 'react';
import type { TelegramAuthPayload } from '@/lib/telegram-auth';

interface TelegramLoginButtonProps {
  /** Called with the signed widget payload once the user authorizes. */
  onAuth: (payload: TelegramAuthPayload) => void;
}

declare global {
  interface Window {
    onTelegramAuth?: (payload: TelegramAuthPayload) => void;
  }
}

/**
 * Renders Telegram's official login widget.
 * Requires NEXT_PUBLIC_TELEGRAM_BOT (bot username, no @) — renders nothing
 * when unset, so environments without the bot degrade gracefully.
 * The bot must have the site registered via BotFather /setdomain.
 */
export function TelegramLoginButton({ onAuth }: TelegramLoginButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !botName) return;

    window.onTelegramAuth = onAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write'); // lets the bot DM reminders
    host.appendChild(script);

    return () => {
      host.innerHTML = '';
      delete window.onTelegramAuth;
    };
  }, [botName, onAuth]);

  if (!botName) return null;
  return <div ref={hostRef} className="flex justify-center" />;
}
