'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, LogOut, BookmarkX, Send, CheckCircle2, Bell, Trash2,
} from 'lucide-react';
import { useDb, useAuth } from '@/supabase';
import { useSaved } from '@/context/SavedContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { catHue } from '@/lib/categoryColor';
import { eventSlug } from '@/lib/event-path';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { EventCard } from '@/components/home/EventCard';
import { TelegramConnectButton } from '@/components/TelegramConnectButton';

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

  // Bumped on window focus so returning from the Telegram connect flow
  // refreshes the card into its "connected" state without a manual reload.
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => setNow(new Date()), []);

  useEffect(() => {
    const onFocus = () => setProfileVersion((v) => v + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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
  }, [supabase, user, profileVersion]);

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
  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // ── Delete account (right to erasure) ─────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    if (!res.ok) {
      setDeleting(false);
      toast({ title: t.authErrorGeneric, variant: 'destructive' });
      return;
    }
    await signOut();
    toast({ title: t.deleteAccountDone });
    router.replace('/');
  };

  if (!profile) {
    return (
      <>
        <SiteNav />
        <main className="container flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  const initial = (profile.display_name || user?.email || '?').trim().charAt(0).toUpperCase();
  const savedCount = savedRows?.filter((r) => r.events).length ?? 0;
  const fieldLabel = 'text-eyebrow mb-1.5 block';

  return (
    <>
      <SiteNav />
      <main className="container py-8 md:py-12">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-foreground pb-6">
          <div className="flex items-center gap-5">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 border border-foreground object-cover md:h-20 md:w-20"
              />
            ) : (
              <span className="grid h-16 w-16 place-items-center bg-foreground font-display text-3xl font-black text-background md:h-20 md:w-20 md:text-4xl">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-eyebrow text-accent">{t.accountTitle}</p>
              <h1 className="mt-1 truncate font-display text-4xl font-black tracking-[-0.035em] md:text-6xl">
                {profile.display_name || t.accountTitle}
              </h1>
              <p className="font-label mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            {t.signOut}
          </Button>
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_1px_24rem] lg:gap-12">
          {/* ── Saved opportunities ────────────────────────────────────── */}
          <section className="min-w-0">
            <h2 className="flex items-baseline justify-between gap-4 border-b-2 border-foreground pb-2">
              <span className="font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">{t.savedSection}</span>
              {savedRows !== null && <span className="font-label text-sm tabular-nums text-muted-foreground">{savedCount}</span>}
            </h2>
            {savedRows === null ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedRows.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-4 border border-dashed border-foreground py-20 text-center">
                <BookmarkX className="h-8 w-8 text-muted-foreground" />
                <p className="text-lg italic text-muted-foreground">{t.noSaved}</p>
                <Button variant="outline" onClick={() => router.push('/#opportunities')}>
                  {t.browseCta}
                </Button>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 md:gap-5">
                {savedRows
                  .filter((r) => r.events)
                  .map((row) => (
                    <EventCard
                      key={row.id}
                      event={row.events}
                      t={t}
                      locale={locale}
                      now={now}
                      onOpen={() => router.push(`/event/${eventSlug(row.events)}`)}
                      hue={catHue(row.events.source)}
                    />
                  ))}
              </div>
            )}
          </section>

          <span aria-hidden className="hidden bg-foreground lg:block" />

          <aside className="space-y-12">
            {/* ── Profile ──────────────────────────────────────────────── */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h2 className="text-eyebrow border-b-2 border-foreground pb-2">{t.profileSection}</h2>
              <div>
                <label htmlFor="pf-name" className={fieldLabel}>{t.displayName}</label>
                <Input id="pf-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pf-age" className={fieldLabel}>{t.ageLabel}</label>
                  <Input
                    id="pf-age"
                    type="number"
                    inputMode="numeric"
                    min={13}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label htmlFor="pf-country" className={fieldLabel}>{t.countryLabel}</label>
                  <Input id="pf-country" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="pf-interests" className={fieldLabel}>{t.interestsLabel}</label>
                <Input
                  id="pf-interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder={t.interestsHint}
                />
              </div>

              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 border-y border-foreground py-3">
                <span className="font-label flex items-center gap-2 text-[0.95rem] font-semibold">
                  <Bell className="h-4 w-4 text-accent" />
                  {t.remindersToggle}
                </span>
                <input
                  type="checkbox"
                  checked={remindersEnabled}
                  onChange={(e) => setRemindersEnabled(e.target.checked)}
                  className="h-5 w-5 accent-[hsl(var(--foreground))]"
                />
              </label>
              <p className="text-sm italic text-muted-foreground">{t.remindersHint}</p>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.saveProfile}
              </Button>
            </form>

            {/* ── Telegram ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              <h2 className="text-eyebrow flex items-center gap-2 border-b-2 border-foreground pb-2">
                <Send className="h-3.5 w-3.5" />
                {t.telegramSection}
              </h2>
              {profile.telegram_chat_id ? (
                <p className="flex items-center gap-2 italic text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  {t.telegramConnected}
                  {profile.telegram_username && (
                    <span className="font-semibold not-italic text-foreground">@{profile.telegram_username}</span>
                  )}
                </p>
              ) : (
                <>
                  <p className="italic text-muted-foreground">{t.telegramConnectHint}</p>
                  <TelegramConnectButton className="w-full" />
                </>
              )}
            </div>

            {/* ── Delete account ─────────────────────────────────────── */}
            <div className="space-y-3 border border-destructive p-5">
              <h2 className="text-eyebrow text-destructive">{t.deleteAccount}</h2>
              <p className="text-sm italic leading-relaxed text-muted-foreground">{t.deleteAccountBody}</p>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                {t.deleteAccount}
              </Button>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter t={t} />

      <Dialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-black">{t.deleteAccountTitle}</DialogTitle>
            <DialogDescription className="italic">{t.deleteAccountBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              {t.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t.deleteAccountConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
