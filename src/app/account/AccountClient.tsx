'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, LogOut, UserRound, BookmarkX, Send, CheckCircle2, Bell,
} from 'lucide-react';
import { useDb, useAuth } from '@/supabase';
import { useSaved } from '@/context/SavedContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { catHue } from '@/lib/categoryColor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { EventCard } from '@/components/home/EventCard';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import type { TelegramAuthPayload } from '@/lib/telegram-auth';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  age: number | null;
  country: string | null;
  interests: string[] | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  reminders_enabled: boolean;
}

interface SavedRow {
  id: string;
  created_at: string;
  events: any;
}

export function AccountClient() {
  const supabase = useDb();
  const { user, session, signOut } = useAuth();
  const { version } = useSaved();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedRows, setSavedRows] = useState<SavedRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Form state (kept separate so typing doesn't mutate the loaded profile)
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => setNow(new Date()), []);

  // ── Load profile ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProfile(data as Profile);
        setDisplayName(data.display_name ?? '');
        setAge(data.age != null ? String(data.age) : '');
        setCountry(data.country ?? '');
        setInterests((data.interests ?? []).join(', '));
        setRemindersEnabled(data.reminders_enabled ?? true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  // ── Load saved opportunities (refetches after each save/unsave) ───────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('saved_opportunities')
      .select(
        'id, created_at, events(id,title,description,location,deadline,language,age_min,age_max,source,created_at,research_data)',
      )
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setSavedRows((data as unknown as SavedRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user, version]);

  // ── Save profile ──────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const parsedAge = age.trim() === '' ? null : Number(age);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        age: Number.isFinite(parsedAge as number) ? parsedAge : null,
        country: country.trim() || null,
        interests: interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        reminders_enabled: remindersEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: t.authErrorGeneric, description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t.profileSaved });
    }
  };

  // ── Connect Telegram to this account ──────────────────────────────────
  const handleTelegramConnect = useCallback(
    async (payload: TelegramAuthPayload) => {
      if (!session) return;
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: 'connect', payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((p) =>
          p ? { ...p, telegram_chat_id: payload.id, telegram_username: payload.username ?? null } : p,
        );
        toast({ title: t.telegramConnectedToast });
      } else {
        toast({
          title: t.authErrorGeneric,
          description: data.error === 'telegram_already_linked' ? t.telegramAlreadyLinked : data.error,
          variant: 'destructive',
        });
      }
    },
    [session, toast, t],
  );

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!profile) {
    return (
      <>
        <SiteNav />
        <main className="container flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <main className="container min-h-screen py-28 md:py-32">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="h-14 w-14 rounded-2xl border border-border object-cover"
              />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card">
                <UserRound className="h-6 w-6 text-muted-foreground" />
              </span>
            )}
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {profile.display_name || t.accountTitle}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t.signOut}
          </Button>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_1fr]">
          {/* ── Profile column ─────────────────────────────────────────── */}
          <div className="space-y-8">
            <form
              onSubmit={handleSaveProfile}
              className="space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8"
            >
              <h2 className="font-display text-xl font-semibold">{t.profileSection}</h2>

              <div>
                <label htmlFor="pf-name" className="mb-1.5 block text-sm font-medium">
                  {t.displayName}
                </label>
                <Input id="pf-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pf-age" className="mb-1.5 block text-sm font-medium">
                    {t.ageLabel}
                  </label>
                  <Input
                    id="pf-age"
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label htmlFor="pf-country" className="mb-1.5 block text-sm font-medium">
                    {t.countryLabel}
                  </label>
                  <Input id="pf-country" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="pf-interests" className="mb-1.5 block text-sm font-medium">
                  {t.interestsLabel}
                </label>
                <Input
                  id="pf-interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder={t.interestsHint}
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4 text-accent" />
                  {t.remindersToggle}
                </span>
                <input
                  type="checkbox"
                  checked={remindersEnabled}
                  onChange={(e) => setRemindersEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--accent))]"
                />
              </label>
              <p className="text-xs text-muted-foreground">{t.remindersHint}</p>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.saveProfile}
              </Button>
            </form>

            {/* ── Telegram ───────────────────────────────────────────── */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Send className="h-5 w-5 text-accent" />
                {t.telegramSection}
              </h2>
              {profile.telegram_chat_id ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  {t.telegramConnected}
                  {profile.telegram_username && (
                    <span className="font-medium text-foreground">@{profile.telegram_username}</span>
                  )}
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t.telegramConnectHint}</p>
                  <TelegramLoginButton onAuth={handleTelegramConnect} />
                </>
              )}
            </div>
          </div>

          {/* ── Saved opportunities ────────────────────────────────────── */}
          <div>
            <h2 className="mb-6 font-display text-xl font-semibold">{t.savedSection}</h2>
            {savedRows === null ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedRows.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
                <BookmarkX className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">{t.noSaved}</p>
                <Button variant="outline" onClick={() => router.push('/#opportunities')}>
                  {t.browseCta}
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {savedRows
                  .filter((r) => r.events)
                  .map((row) => (
                    <EventCard
                      key={row.id}
                      event={row.events}
                      t={t}
                      locale={locale}
                      now={now}
                      onOpen={() => router.push(`/event/${row.events.id}`)}
                      hue={catHue(row.events.source)}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter t={t} onCategory={() => router.push('/')} />
    </>
  );
}
