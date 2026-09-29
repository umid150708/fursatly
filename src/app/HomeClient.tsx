'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, ArrowRight, Loader2, X, Send } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDb } from '@/supabase';
import { useCollection } from '@/supabase/use-collection';
import { translateSource, translateLanguage, type Locale } from '@/lib/translations';
import { catHue } from '@/lib/categoryColor';
import { canonicalSource, rawSourcesFor } from '@/lib/canonicalCategory';
import { EVENT_LIST_SELECT, mapEventListRow } from '@/lib/event-list';
import { eventSlug } from '@/lib/event-path';
import { pickLead, closingThisWeek, inBrief, deadlineForecast } from '@/lib/front-page';
import { MONTHS, formatDate, deadlineMs, daysUntil, daysLeftLabel } from '@/lib/dates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from '@/components/ui/sheet';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { EventCard } from '@/components/home/EventCard';
import { FloatingCards } from '@/components/home/FloatingCards';
import { SECTIONS } from '@/components/home/sections';

/** The lead story's researched summary, fetched by the server page. */
export interface LeadDetail {
  id: string;
  en: string | null;
  uz: string | null;
  ru: string | null;
}

/**
 * Classify an event's free-text location into a coarse region bucket so the
 * location filter actually matches the data (the DB has ~40 messy values like
 * "International", "O'zbekiston", "USA (Online)"). Returns null for blank/unknown
 * locations so they only surface under "All".
 */
const UZ_RE = /o['`´‘’ʻ]?zbek|uzbek|toshkent|tashkent|samarq|samarkand|buxor|bukhara|xorazm|khorezm|qashqa|surxon|farg'?ona|fergana|andijon|namangan|navoiy|jizzax|sirdaryo|nukus|qoraqal|karakalpak/;
const ONLINE_RE = /online|onlayn|remote|masofa|virtual/;
type LocBucket = 'uz' | 'online' | 'abroad';
function locationBucket(loc?: string | null): LocBucket | null {
  const s = (loc || '').trim().toLowerCase();
  if (!s) return null;
  if (UZ_RE.test(s)) return 'uz';       // local (incl. "O'zbekiston (Onlayn)")
  if (ONLINE_RE.test(s)) return 'online';
  return 'abroad';                       // International, USA, Germany, …
}

const DAY = 86_400_000;

/** Pick the display title for the active locale, falling back to English. */
const titleOf = (e: any, locale: Locale): string =>
  (locale !== 'en' && e?.research_data?.translations?.[locale]?.title) || e?.title || '';

/**
 * Client half of the homepage — the Gazette's front page. The server page
 * (./page.tsx) fetches the trimmed events list with ISR and passes it as
 * `initialEvents`, plus the time it rendered at, so the first paint lays out
 * the same front page the client would: filters and polling then re-fetch
 * client-side exactly as before.
 */
export default function HomeClient({
  initialEvents = null,
  renderedAt = null,
  leadDetail = null,
}: {
  initialEvents?: any[] | null;
  renderedAt?: number | null;
  leadDetail?: LeadDetail | null;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const supabase = useDb();

  // The browser's clock, once mounted. Until then everything is laid out
  // against the server's render time, so hydration sees identical markup.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const refNow = useMemo(() => now ?? (renderedAt ? new Date(renderedAt) : null), [now, renderedAt]);
  const nowMs = refNow?.getTime() ?? null;

  // ── Filter state (unchanged contract) ────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState([0, 100]);
  const [filterFunding, setFilterFunding] = useState<'All' | 'Full' | 'Partial'>('All');
  const [filterDeadline, setFilterDeadline] = useState<'All' | 'week' | 'month' | '3months'>('All');

  // Arriving from another page's section link: /?cat=Scholarships#opportunities
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get('cat');
    if (cat && SECTIONS.some((s) => s.id === cat)) setActiveCategory(cat);
  }, []);

  // Location + language are filtered client-side (see `filteredEvents`) — the DB
  // stores messy free-text, so exact `.eq()` matching silently returned nothing.
  // Only the category (source) is narrowed server-side.
  const eventsQueryFn = useCallback(() => {
    if (!supabase) return Promise.resolve({ data: null, error: null });
    let q = supabase
      .from('events')
      // Trimmed select — only the research_data leaves the list actually renders
      // (~92% smaller than pulling the whole blob). Rows are mapped back into
      // the nested research_data shape the components expect.
      .select(EVENT_LIST_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(300);
    // Match aliases too ("Grants", "Fellowships"… fold into their canonical category)
    if (activeCategory) q = q.in('source', rawSourcesFor(activeCategory));
    return q.then(({ data, error }) => ({
      data: data ? data.map(mapEventListRow) : null,
      error,
    }));
  }, [supabase, activeCategory]);

  const { data: dbEvents, isLoading } = useCollection(supabase, eventsQueryFn, initialEvents);

  const filteredEvents = React.useMemo(() => {
    if (!dbEvents) return [];
    const ref = nowMs ?? 0;
    return dbEvents.filter((event) => {
      if (event.deadline) {
        const dl = deadlineMs(event.deadline);
        if (dl < ref) return false;
        if (filterDeadline !== 'All') {
          const win = filterDeadline === 'week' ? 7 * DAY : filterDeadline === 'month' ? 30 * DAY : 90 * DAY;
          if (dl > ref + win) return false;
        }
      }
      const matchesLocation = filterLocation === 'All' || locationBucket(event.location) === filterLocation;
      const matchesLanguage = filterLanguage === 'All' || (event.language || '').toLowerCase() === filterLanguage.toLowerCase();
      const hasAgeFilter = ageRange[0] > 0 || ageRange[1] < 100;
      const matchesAge = !hasAgeFilter || (
        (event.age_min >= ageRange[0] && event.age_min <= ageRange[1]) ||
        (event.age_max >= ageRange[0] && event.age_max <= ageRange[1]) ||
        (event.age_min <= ageRange[0] && event.age_max >= ageRange[1])
      );
      const title = (event.title || '').toLowerCase();
      const desc = (event.description || '').toLowerCase();
      const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase());
      const matchesFunding = filterFunding === 'All' || (event.research_data as any)?.funding_type === filterFunding;
      return matchesLocation && matchesLanguage && matchesAge && matchesSearch && matchesFunding;
    });
  }, [dbEvents, ageRange, searchTerm, nowMs, filterFunding, filterDeadline, filterLocation, filterLanguage]);

  // ── Front page: lead, closing this week, in brief, forecast ──────────────
  const front = useMemo(() => {
    if (!dbEvents || nowMs === null) return null;
    const lead = pickLead(dbEvents, nowMs);
    const closing = closingThisWeek(dbEvents, nowMs);
    const exclude = new Set([lead?.id, ...closing.map((e) => e.id)].filter(Boolean) as string[]);
    const brief = inBrief(dbEvents, nowMs, exclude, 4);
    brief.forEach((e) => exclude.add(e.id));
    return {
      lead,
      closing,
      brief,
      // Two more stories run under the lead, so the centre column is not left
      // short beside the two side columns.
      secondary: inBrief(dbEvents, nowMs, exclude, 2),
      forecast: deadlineForecast(dbEvents, nowMs),
    };
  }, [dbEvents, nowMs]);

  const groupedEvents = React.useMemo(() => {
    if (activeCategory) return null;
    const groups: Record<string, any[]> = {};
    filteredEvents.forEach((e) => {
      (groups[canonicalSource(e.source)] ||= []).push(e);
    });
    return groups;
  }, [filteredEvents, activeCategory]);

  // Floating clippings. In "All" mode → one story per section (the "catalog
  // difference"). With a section selected → several stories from THAT section,
  // so the banner mirrors the current selection instead of a lone clipping.
  const floatingCards = React.useMemo(() => {
    if (!dbEvents) return [];
    const seen = new Set<string>();
    const out: { id: string; title: string; category: string; hue: string }[] = [];
    for (const e of dbEvents) {
      const cat = canonicalSource(e.source);
      if (!activeCategory && seen.has(cat)) continue; // dedupe per-section only in "All" mode
      seen.add(cat);
      out.push({ id: eventSlug(e), title: titleOf(e, locale), category: translateSource(cat, t), hue: catHue(cat) });
      if (out.length >= 6) break;
    }
    return out;
  }, [dbEvents, locale, t, activeCategory]);

  const daysLeft = (deadline?: string | null) => (nowMs !== null ? daysUntil(deadline, nowMs) : null);

  const shortDate = (iso?: string | null) => (iso ? formatDate(iso, locale) : t.rolling);

  const activeFilterCount =
    (filterLocation !== 'All' ? 1 : 0) +
    (filterLanguage !== 'All' ? 1 : 0) +
    (ageRange[0] > 0 || ageRange[1] < 100 ? 1 : 0) +
    (filterFunding !== 'All' ? 1 : 0) +
    (filterDeadline !== 'All' ? 1 : 0);

  const resetFilters = () => {
    setFilterLocation('All'); setFilterLanguage('All'); setSearchTerm('');
    setAgeRange([0, 100]); setFilterFunding('All'); setFilterDeadline('All');
  };

  const open = (idOrSlug: string) => router.push(`/event/${idOrSlug}`);
  const href = (e: any) => `/event/${eventSlug(e)}`;

  // Browse vs. searching: once the user narrows anything, results matter more
  // than the front page, so the results move straight under the banner.
  const isFiltering = searchTerm.trim() !== '' || activeFilterCount > 0 || activeCategory !== null;

  // Scroll to the results. Programmatic scroll routes through Lenis (native
  // scrollIntoView fights its rAF loop); `force` overrides Lenis' own guards.
  const scrollToResults = () => {
    const el = document.getElementById('opportunities');
    if (!el) return;
    const lenis = (window as any).lenis;
    if (lenis?.scrollTo) lenis.scrollTo(el, { offset: -72, force: true });
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // A section picked from the bar: filter in place, keep the URL shareable,
  // and bring the section into view once it has rendered.
  const chooseSection = (id: string | null) => {
    setActiveCategory(id);
    try {
      window.history.replaceState(null, '', id ? `/?cat=${encodeURIComponent(id)}` : '/');
    } catch { /* history is best-effort */ }
    requestAnimationFrame(() => requestAnimationFrame(scrollToResults));
  };

  // Reveal the results when the filter sheet closes. The sheet's scroll-lock
  // (react-remove-scroll) freezes scrolling AND clamps a too-early scroll, so we
  // poll a few frames until the lock lifts, then scroll (giving up after ~1s).
  const onFilterOpenChange = (isOpen: boolean) => {
    if (isOpen) return;
    const start = performance.now();
    const waitThenScroll = () => {
      const locked = document.body.style.overflow === 'hidden';
      if (locked && performance.now() - start < 1000) { requestAnimationFrame(waitThenScroll); return; }
      scrollToResults();
    };
    requestAnimationFrame(waitThenScroll);
  };

  const feats = [
    { title: t.feat1Title, keywords: t.feat1Keys },
    { title: t.feat2Title, keywords: t.feat2Keys },
    { title: t.feat3Title, keywords: t.feat3Keys },
    { title: t.feat4Title, keywords: t.feat4Keys },
  ];

  // ── Filter panel (Sheet body) ────────────────────────────────────────────
  // Ruled option boxes: hairline when idle, inked in when chosen.
  const fchip = (active: boolean) =>
    `font-label flex h-11 items-center justify-center border px-3 text-sm font-semibold uppercase tracking-[0.06em] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
    }`;

  const locationOptions = [
    { id: 'All', label: t.all },
    { id: 'uz', label: t.locUzbekistan },
    { id: 'online', label: t.locOnline },
    { id: 'abroad', label: t.locAbroad },
  ];

  const filterSection = (label: string, control: React.ReactNode) => (
    <div className="space-y-3">
      <label className="text-eyebrow block text-muted-foreground">{label}</label>
      {control}
    </div>
  );

  const renderFilterPanel = () => (
    <div className="space-y-8">
      {filterSection(t.location, (
        <div className="grid grid-cols-2 gap-2">
          {locationOptions.map((loc) => (
            <button key={loc.id} className={fchip(filterLocation === loc.id)} onClick={() => setFilterLocation(loc.id)}>
              {loc.label}
            </button>
          ))}
        </div>
      ))}
      {filterSection(t.language, (
        <div className="grid grid-cols-4 gap-2">
          {['All', 'English', 'Uzbek', 'Russian'].map((lang) => (
            <button key={lang} className={fchip(filterLanguage === lang)} onClick={() => setFilterLanguage(lang)}>
              {lang === 'All' ? t.all : lang === 'English' ? 'EN' : lang === 'Uzbek' ? 'UZ' : 'RU'}
            </button>
          ))}
        </div>
      ))}
      {filterSection(t.fundingCoverage, (
        <div className="grid grid-cols-3 gap-2">
          {[{ id: 'All', l: t.fundingAny }, { id: 'Full', l: t.fundingFull }, { id: 'Partial', l: t.fundingPartial }].map((o) => (
            <button key={o.id} className={fchip(filterFunding === o.id)} onClick={() => setFilterFunding(o.id as any)}>{o.l}</button>
          ))}
        </div>
      ))}
      {filterSection(t.deadline, (
        <div className="grid grid-cols-2 gap-2">
          {[{ id: 'All', l: t.deadlineAny }, { id: 'week', l: t.deadlineWeek }, { id: 'month', l: t.deadlineMonth }, { id: '3months', l: t.deadline3Months }].map((o) => (
            <button key={o.id} className={fchip(filterDeadline === o.id)} onClick={() => setFilterDeadline(o.id as any)}>{o.l}</button>
          ))}
        </div>
      ))}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-eyebrow block text-muted-foreground">{t.age}</label>
          <span className="font-label border border-foreground px-2 py-0.5 text-sm font-semibold tabular-nums">{ageRange[0]}–{ageRange[1]}</span>
        </div>
        <Slider max={100} step={1} minStepsBetweenThumbs={1} value={ageRange} onValueChange={setAgeRange} />
        <div className="font-label flex justify-between text-sm text-muted-foreground">
          <span>{ageRange[0]} {t.minAge}</span>
          <span>{ageRange[1]} {t.maxAge}</span>
        </div>
      </div>
    </div>
  );

  const storyGrid = (events: any[], kicker: 'category' | 'location' = 'category') => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          t={t}
          locale={locale}
          now={refNow}
          onOpen={() => open(eventSlug(event))}
          hue={catHue(event.source)}
          kicker={kicker}
        />
      ))}
    </div>
  );

  // ── Banner: the headline, search, and the floating clippings ────────────
  const banner = (
    <section className="relative overflow-hidden border-b border-foreground">
      <FloatingCards cards={floatingCards} onOpen={open} />
      <div className="container relative z-10 py-10 md:py-14 lg:min-h-[40rem]">
        <div className="max-w-2xl lg:max-w-[46%]">
          <p className="text-eyebrow text-accent">
            {t.openNow}{front && !activeCategory
              ? ` · ${front.forecast.thisWeek + front.forecast.nextWeek + front.forecast.later + front.forecast.rolling}`
              : ''}
          </p>
          <h1 className="text-hero mt-4">{t.heroTitle}</h1>
          <p className="mt-5 text-xl italic leading-snug text-muted-foreground md:text-2xl">{t.heroSubtitle}</p>

          <div className="mt-8 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="h-14 pl-12 text-base"
              />
            </div>
            <Sheet onOpenChange={onFilterOpenChange}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative h-14 w-14 p-0 sm:w-auto sm:px-5" aria-label={t.filterTitle}>
                  <SlidersHorizontal className="h-5 w-5" />
                  <span className="hidden sm:inline">{t.filterTitle}</span>
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden border-l border-foreground p-0 sm:max-w-md">
                <SheetHeader className="space-y-1 border-b border-foreground px-6 py-5 text-left">
                  <SheetTitle className="font-display text-3xl font-black">{t.filterTitle}</SheetTitle>
                  <p className="font-label text-sm uppercase tracking-[0.06em] text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{filteredEvents.length}</span> {t.resultsLabel}
                  </p>
                </SheetHeader>
                <div data-lenis-prevent className="flex-1 overflow-y-auto px-6 py-6">
                  {renderFilterPanel()}
                </div>
                <div className="flex items-center gap-3 border-t border-foreground p-4">
                  <Button variant="outline" className="flex-1" onClick={resetFilters} disabled={activeFilterCount === 0}>
                    <X className="h-4 w-4" /> {t.resetAll}
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1">{t.showResults}</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  );

  // ── Front page: closing this week │ lead │ in brief ──────────────────────
  const lead = front?.lead ?? null;
  const leadDays = lead ? daysLeft(lead.deadline) : null;
  const leadSummary =
    lead && leadDetail && leadDetail.id === lead.id ? leadDetail[locale] || leadDetail.en : null;

  const frontPage = front && (
    <section className="container py-8 md:py-12">
      <div className="grid gap-12 lg:grid-cols-[15rem_1px_minmax(0,1fr)_1px_15rem] lg:gap-8 xl:grid-cols-[17rem_1px_minmax(0,1fr)_1px_17rem]">
        <aside className="order-2 lg:order-none dark:bg-card dark:px-4 dark:py-4">
          <h2 className="text-eyebrow flex items-center justify-between border-b-2 border-foreground pb-2 text-urgent">
            <span>{t.closingSoon}</span>
            <span className="tabular-nums text-muted-foreground">{front.forecast.thisWeek}</span>
          </h2>
          {front.closing.length === 0 ? (
            <p className="py-4 italic text-muted-foreground">—</p>
          ) : (
            <ol>
              {front.closing.map((e) => {
                const d = new Date(e.deadline);
                return (
                  <li key={e.id} className="border-b border-border">
                    <Link href={href(e)} className="group grid grid-cols-[2.75rem_1fr] gap-3 py-3.5">
                      <span className="font-label flex flex-col leading-none">
                        <span className="text-[1.6rem] font-bold">{String(d.getDate()).padStart(2, '0')}</span>
                        <span className="text-eyebrow mt-1 text-[0.7rem] text-muted-foreground">{MONTHS[locale][d.getMonth()]}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-3 font-bold leading-snug decoration-1 underline-offset-4 group-hover:underline dark:font-semibold dark:text-foreground/90">{titleOf(e, locale)}</span>
                        <span className="font-label mt-1 block truncate text-sm text-muted-foreground">{e.location || '—'}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>

        <span aria-hidden className="hidden bg-foreground dark:bg-border lg:block" />

        {lead ? (
          <article className="order-1 min-w-0 lg:order-none">
            <p className="text-eyebrow text-accent">
              {[
                translateSource(lead.source || 'Other', t),
                lead.research_data?.funding_type === 'Full' ? t.fullyFunded : null,
                lead.location,
              ].filter(Boolean).join(' · ')}
            </p>
            <h2 className="mt-3 font-display text-[2.4rem] font-black leading-[0.98] tracking-[-0.03em] md:text-6xl lg:text-5xl xl:text-6xl">
              <Link href={href(lead)} className="decoration-2 underline-offset-8 hover:underline">{titleOf(lead, locale)}</Link>
            </h2>
            <p className="mt-4 text-lg italic text-muted-foreground md:text-xl">
              {t.deadlineLabel}: {shortDate(lead.deadline)}
              {lead.language ? ` · ${translateLanguage(lead.language, t)}` : ''}
            </p>
            <Link
              href={href(lead)}
              className="halftone mt-6 flex h-44 items-center justify-center border border-foreground md:h-56"
              aria-label={titleOf(lead, locale)}
            >
              <span className="flex items-center gap-4 bg-background px-5 py-3">
                {leadDays !== null && leadDays > 1 ? (
                  <>
                    <span className="font-display text-7xl font-black leading-none tracking-[-0.05em] md:text-9xl">{leadDays}</span>
                    <span className="text-eyebrow max-w-[7rem] text-base leading-tight">{t.daysLeft}</span>
                  </>
                ) : (
                  <span className="text-eyebrow text-2xl">
                    {leadDays === null ? t.rolling : daysLeftLabel(leadDays, t)}
                  </span>
                )}
              </span>
            </Link>
            {leadSummary && (
              <p className="dropcap mt-6 max-w-[65ch] text-[1.05rem] leading-relaxed">{leadSummary}</p>
            )}
            <Link href={href(lead)} className="text-eyebrow mt-5 inline-flex min-h-11 items-center gap-2 transition-colors hover:text-accent">
              {t.readFull} <ArrowRight className="h-4 w-4" />
            </Link>
            {front.secondary.length > 0 && (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
                {front.secondary.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    t={t}
                    locale={locale}
                    now={refNow}
                    onOpen={() => open(eventSlug(e))}
                    hue={catHue(e.source)}
                  />
                ))}
              </div>
            )}
          </article>
        ) : (
          <div className="order-1 lg:order-none" />
        )}

        <span aria-hidden className="hidden bg-foreground dark:bg-border lg:block" />

        <aside className="order-3 lg:order-none dark:bg-card dark:px-4 dark:py-4">
          <h2 className="text-eyebrow border-b-2 border-foreground pb-2">{t.inBrief}</h2>
          <ul>
            {front.brief.map((e) => (
              <li key={e.id} className="border-b border-border">
                <Link href={href(e)} className="group block py-4">
                  <span className="text-eyebrow block text-[0.7rem]" style={{ color: `hsl(${catHue(e.source)})` }}>
                    {translateSource(e.source || 'Other', t)}{e.location ? ` · ${e.location}` : ''}
                  </span>
                  <span className="mt-1.5 block font-display text-xl font-bold leading-tight decoration-1 underline-offset-4 group-hover:underline dark:font-semibold dark:text-foreground/90">
                    {titleOf(e, locale)}
                  </span>
                  <span className="mt-1.5 block text-[0.95rem] italic text-muted-foreground">
                    {e.research_data?.funding_type === 'Full' ? `${t.fullyFunded} · ` : ''}{shortDate(e.deadline)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 border border-foreground p-4">
            <h3 className="text-eyebrow">{t.forecastTitle}</h3>
            <dl className="font-label mt-3 space-y-2 text-[0.95rem]">
              {[
                { k: t.forecastThisWeek, v: front.forecast.thisWeek },
                { k: t.forecastNextWeek, v: front.forecast.nextWeek },
                { k: t.forecastLater, v: front.forecast.later },
                { k: t.rolling, v: front.forecast.rolling },
              ].map(({ k, v }) => (
                <div key={k} className="flex items-baseline justify-between border-b border-dotted border-muted-foreground pb-1.5">
                  <dt>{k}</dt>
                  <dd className="font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );

  // ── Sections / results ───────────────────────────────────────────────────
  const exploreSection = (
    <section id="opportunities" className="container scroll-mt-24 pt-10">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="mt-5 italic text-muted-foreground">{t.loading}</p>
        </div>
      ) : activeCategory ? (
        <div>
          <div className="rule-heavy flex items-end justify-between gap-4 pt-4">
            <div className="min-w-0">
              <p className="text-eyebrow" style={{ color: `hsl(${catHue(activeCategory)})` }}>
                {filteredEvents.length} · {t.exploreLead}
              </p>
              <h2 className="text-display mt-2 truncate">{translateSource(activeCategory, t)}</h2>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => chooseSection(null)}>
              <X className="h-4 w-4" /> <span className="hidden sm:inline">{t.closeCategory}</span>
            </Button>
          </div>
          <div className="mt-8">
            {filteredEvents.length === 0 ? emptyState() : storyGrid(filteredEvents, 'location')}
          </div>
        </div>
      ) : isFiltering ? (
        <div>
          <div className="rule-heavy flex items-end justify-between gap-4 pt-4">
            <div>
              <p className="text-eyebrow text-accent">{t.exploreLead}</p>
              <h2 className="text-display mt-2">{t.exploreTitle}</h2>
            </div>
            <span className="font-label shrink-0 text-sm tabular-nums text-muted-foreground">
              {filteredEvents.length} / {dbEvents?.length ?? 0}
            </span>
          </div>
          <div className="mt-8">
            {filteredEvents.length === 0 ? emptyState() : storyGrid(filteredEvents)}
          </div>
        </div>
      ) : (
        <div className="space-y-16">
          {Object.entries(groupedEvents || {})
            .sort(([a], [b]) => {
              const ia = SECTIONS.findIndex((s) => s.id === a);
              const ib = SECTIONS.findIndex((s) => s.id === b);
              return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            })
            .map(([cat, events]) => (
              <div key={cat}>
                <div className="rule-heavy flex items-end justify-between gap-4 pt-3">
                  <h2 className="font-display text-3xl font-black tracking-[-0.03em] md:text-5xl">
                    {translateSource(cat, t)}
                  </h2>
                  <button
                    type="button"
                    onClick={() => chooseSection(cat)}
                    className="text-eyebrow group flex min-h-11 shrink-0 items-center gap-2 transition-colors hover:text-accent"
                  >
                    <span style={{ color: `hsl(${catHue(cat)})` }} className="tabular-nums">{events.length}</span>
                    <span className="hidden sm:inline">{t.viewAll}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
                <div className="mt-6">{storyGrid(events.slice(0, 4), 'location')}</div>
              </div>
            ))}
        </div>
      )}
    </section>
  );

  function emptyState() {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-foreground py-24 text-center">
        <Search className="h-8 w-8 text-muted-foreground" />
        <p className="mt-5 text-xl italic text-muted-foreground">{t.noEvents}</p>
        {(searchTerm || activeFilterCount > 0 || activeCategory) && (
          <Button variant="link" className="mt-3" onClick={() => { resetFilters(); chooseSection(null); }}>
            {t.clearFilters}
          </Button>
        )}
      </div>
    );
  }

  // ── Editorial: mission │ why Fursatly ────────────────────────────────────
  const editorial = (
    <section className="container mt-24">
      <div className="rule-heavy grid gap-12 pt-8 lg:grid-cols-[minmax(0,1.35fr)_1px_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="text-eyebrow">{t.missionLead}</p>
          <h2 className="mt-4 font-display text-4xl font-black italic leading-[1.02] tracking-[-0.03em] md:text-6xl">
            {t.missionTitle}
          </h2>
          <p className="dropcap mt-7 max-w-[65ch] text-lg leading-relaxed">{t.missionBody}</p>
        </div>
        <span aria-hidden className="hidden bg-foreground lg:block" />
        <div>
          <p className="text-eyebrow">{t.whyFursatly}</p>
          <p className="font-label mt-3 text-sm uppercase tracking-[0.06em] text-muted-foreground">
            {t.pipelineStart} → {t.pipelineVia} → <span className="text-accent">{t.pipelineEnd}</span>
          </p>
          <ol className="mt-3">
            {feats.map((f, i) => (
              <li key={f.title} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-border py-4">
                <span className="font-display text-3xl font-black leading-none">{i + 1}</span>
                <div>
                  <h3 className="text-xl font-bold leading-tight">{f.title}</h3>
                  <p className="mt-1 italic text-muted-foreground">{f.keywords.join(' · ')}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );

  // ── Telegram: the subscription coupon ────────────────────────────────────
  const subscribe = (
    <section className="container mt-20">
      <div className="flex flex-col gap-6 border-2 border-dashed border-foreground p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="max-w-2xl">
          <p className="text-eyebrow text-accent">Telegram · @fursatly</p>
          <h2 className="text-display mt-3">{t.ctaTitle}</h2>
          <p className="mt-3 text-lg italic text-muted-foreground">{t.ctaDesc}</p>
        </div>
        <a
          href="https://t.me/fursatly"
          target="_blank"
          rel="noopener noreferrer"
          className="font-label inline-flex h-14 shrink-0 items-center justify-center gap-3 bg-foreground px-7 text-base font-semibold uppercase tracking-[0.08em] text-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Send className="h-5 w-5" /> {t.ctaButton}
        </a>
      </div>
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav variant="front" activeSection={activeCategory} onSection={chooseSection} />

      <main className="flex-1">
        {banner}
        {!isFiltering && frontPage}
        {exploreSection}
        {editorial}
        {subscribe}
      </main>

      <SiteFooter t={t} onCategory={chooseSection} />
    </div>
  );
}
