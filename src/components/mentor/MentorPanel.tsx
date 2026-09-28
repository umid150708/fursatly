'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';

/** Dispatch on `window` to open the mentor from elsewhere on the page (the
 *  event page's sidebar does this on wide screens). */
export const OPEN_MENTOR_EVENT = 'fursatly:open-mentor';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** The mentor's mark — an ink square, used in the header and beside every reply. */
function MentorAvatar({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span
      className={`grid shrink-0 place-items-center bg-foreground text-background ${cls}`}
      aria-hidden
    >
      <Sparkles className={icon} />
    </span>
  );
}

/** Three-dot "thinking" indicator (static dots under reduced motion). */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 px-1" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 bg-muted-foreground/70 motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Floating mentor chat on the opportunity page. Conversation lives in local
 * state only (ephemeral). Signed-out taps route to /auth. Each turn posts the
 * running transcript to /api/mentor/chat and appends the reply.
 *
 * Design notes (ui-ux-pro-max): 44px+ touch targets, visible thin scrollbar
 * on the history (scroll affordance), Esc-to-close + autofocus (escape route +
 * focus management), aria-live message log, entrance/typing animations gated
 * behind motion-safe, category-hue theming inherited from the event page.
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view whenever the transcript grows.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Focus the input on open; Esc closes (escape route).
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openPanel = useCallback(() => {
    if (!user) {
      router.push(`/auth?next=/event/${eventId}`);
      return;
    }
    setOpen(true);
  }, [user, router, eventId]);

  useEffect(() => {
    window.addEventListener(OPEN_MENTOR_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_MENTOR_EVENT, openPanel);
  }, [openPanel]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);

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
    } catch {
      setError(t.mentorErrorGeneric);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {/* Launcher — phones and tablets; on wide screens the sidebar carries it */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label={t.mentorTitle}
          className="font-label fixed bottom-6 right-6 z-50 flex h-14 min-w-14 lg:hidden items-center justify-center gap-2.5 bg-foreground px-4 text-sm font-semibold uppercase tracking-[0.08em] text-background shadow-[4px_4px_0_hsl(var(--accent))] transition-colors hover:bg-accent hover:text-accent-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">{t.mentorTitle}</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label={t.mentorTitle}
          className="fixed bottom-4 right-4 z-50 flex h-[min(75dvh,36rem)] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden border border-foreground bg-card shadow-[8px_8px_0_hsl(var(--foreground)/0.14)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:bottom-6 sm:right-6"
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-foreground p-4">
            <MentorAvatar size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-2xl font-black italic leading-tight tracking-[-0.02em]">{t.mentorTitle}</p>
              <p className="font-label mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 bg-emerald-600" aria-hidden />
                <span className="truncate">{t.mentorOnline} · {t.mentorSubtitle}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-11 w-11 shrink-0 place-items-center border border-transparent text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* History — visible thin scrollbar so "scroll up" is discoverable */}
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <div className="flex items-end gap-2">
                <MentorAvatar />
                <div className="max-w-[88%] border-l-2 border-foreground py-0.5 pl-3 text-[0.95rem] leading-relaxed">
                  {t.mentorGreeting}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div
                  key={i}
                  className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap border border-foreground bg-background px-3.5 py-2.5 text-[0.95rem] italic leading-relaxed"
                >
                  {m.content}
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2">
                  <MentorAvatar />
                  <div className="max-w-[88%] whitespace-pre-wrap border-l-2 border-foreground py-0.5 pl-3 text-[0.95rem] leading-relaxed">
                    {m.content}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="flex items-end gap-2">
                <MentorAvatar />
                <div className="border-l-2 border-foreground py-2 pl-3">
                  <span className="sr-only">{t.mentorTyping}</span>
                  <TypingDots />
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="border border-urgent px-3.5 py-2.5 text-sm text-urgent">
                {error}
              </p>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={send} className="flex items-center gap-2 border-t border-foreground p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.mentorPlaceholder}
              aria-label={t.mentorPlaceholder}
              className="h-11 min-w-0 flex-1 border border-input bg-background px-3.5 text-[0.95rem] placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t.mentorSend}
              className="grid h-11 w-11 shrink-0 place-items-center bg-foreground text-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="border-t border-border px-4 py-2 text-center text-xs italic leading-snug text-muted-foreground">
            {t.mentorDisclaimer}
          </p>
        </div>
      )}
    </>
  );
}
