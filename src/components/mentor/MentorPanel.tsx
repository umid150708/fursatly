'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Floating mentor chat on the opportunity page. Conversation lives in local
 * state only (ephemeral). Signed-out taps route to /auth. Each turn posts the
 * running transcript to /api/mentor/chat and appends the reply.
 */
export function MentorPanel({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const openPanel = () => {
    if (!user) {
      router.push(`/auth?next=/event/${eventId}`);
      return;
    }
    setOpen(true);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);
    scrollToEnd();

    try {
      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, messages: next, locale }),
      });

      if (res.status === 401) {
        router.push(`/auth?next=/event/${eventId}`);
        return;
      }
      if (res.status === 429) {
        setError(t.mentorErrorRate);
        return;
      }
      if (!res.ok) {
        setError(res.status === 503 ? t.mentorErrorBusy : t.mentorErrorGeneric);
        return;
      }

      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      scrollToEnd();
    } catch {
      setError(t.mentorErrorGeneric);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Launcher bubble */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label={t.mentorTitle}
          className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div className="min-w-0">
              <p className="font-display font-semibold leading-tight">{t.mentorTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.mentorSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                {t.mentorGreeting}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.mentorTyping}
              </div>
            )}
            {error && <p className="text-sm text-urgent">{error}</p>}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.mentorPlaceholder}
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t.mentorSend}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
