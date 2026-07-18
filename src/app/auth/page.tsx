'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, KeyRound, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import type { TelegramAuthPayload } from '@/lib/telegram-auth';

type Mode = 'signin' | 'signup';

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/account';
  const { t } = useLanguage();
  const {
    user,
    isLoading,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signInWithGoogle,
    verifyTokenHash,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'magic' | 'google' | 'telegram' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in (or session arrives) → leave.
  useEffect(() => {
    if (!isLoading && user) router.replace(next);
  }, [isLoading, user, next, router]);

  // ?error=callback from a failed code exchange
  useEffect(() => {
    if (searchParams.get('error')) setError(t.authErrorGeneric);
  }, [searchParams, t]);

  const translateError = useCallback(
    (raw: string): string => {
      if (/invalid login credentials/i.test(raw)) return t.authErrorCreds;
      if (/rate limit/i.test(raw)) return t.authErrorRate;
      if (/at least 6 characters|password should be/i.test(raw)) return t.authErrorWeakPassword;
      return `${t.authErrorGeneric} (${raw})`;
    },
    [t],
  );

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy('password');
    const result =
      mode === 'signin'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);
    setBusy(null);
    if (result.error) return setError(translateError(result.error));
    if (mode === 'signup' && 'needsConfirm' in result && result.needsConfirm) {
      setNotice(t.authConfirmSent);
      return;
    }
    router.replace(next);
  };

  const handleMagic = async () => {
    if (!email) return setError(t.authEmailFirst);
    setError(null);
    setNotice(null);
    setBusy('magic');
    const { error: err } = await signInWithMagicLink(email);
    setBusy(null);
    if (err) return setError(translateError(err));
    setNotice(t.authMagicSent);
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy('google');
    const { error: err } = await signInWithGoogle();
    // On success the browser redirects away — only errors land here.
    if (err) {
      setBusy(null);
      setError(translateError(err));
    }
  };

  const handleTelegram = useCallback(
    async (payload: TelegramAuthPayload) => {
      setError(null);
      setBusy('telegram');
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'login', payload }),
        });
        const data = await res.json();
        if (!res.ok || !data.token_hash) throw new Error(data.error ?? 'telegram_failed');
        const { error: err } = await verifyTokenHash(data.token_hash);
        if (err) throw new Error(err);
        router.replace(next);
      } catch (e) {
        setBusy(null);
        setError(translateError(e instanceof Error ? e.message : 'telegram_failed'));
      }
    },
    [verifyTokenHash, router, next, translateError],
  );

  return (
    <>
      <SiteNav />
      <main className="container flex min-h-screen items-center justify-center py-28">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 md:p-10">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-eyebrow text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t.backToOpportunities}
          </Link>
          <p className="text-eyebrow mb-2 font-semibold text-accent">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Fursatly
          </p>
          <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight">
            {mode === 'signin' ? t.authTitleIn : t.authTitleUp}
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">{t.authSubtitle}</p>

          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-urgent/40 bg-urgent/10 px-4 py-3 text-sm text-urgent">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
              {notice}
            </p>
          )}

          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
                {t.authEmail}
              </label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
                {t.authPassword}
              </label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === 'password' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {mode === 'signin' ? t.authSignIn : t.authSignUp}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
            className="mt-3 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === 'signin' ? t.authNoAccount : t.authHaveAccount}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t.authOr}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleMagic}
              disabled={busy !== null}
            >
              {busy === 'magic' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {t.authMagic}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={busy !== null}
            >
              {busy === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              {t.authGoogle}
            </Button>
            {busy === 'telegram' ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TelegramLoginButton onAuth={handleTelegram} />
            )}
          </div>
        </div>
      </main>
      <SiteFooter t={t} onCategory={() => router.push('/')} />
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
