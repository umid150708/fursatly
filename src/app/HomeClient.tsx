'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, SlidersHorizontal, ArrowRight, ArrowUpRight, Loader2, X, Flame, Send, Sparkles,
  GraduationCap, Trophy, Sun, FlaskConical, HeartHandshake, Cpu, Briefcase, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDb } from '@/supabase';
import { useCollection } from '@/supabase/use-collection';
import { translateSource } from '@/lib/translations';
import { catHue } from '@/lib/categoryColor';
import { canonicalSource, rawSourcesFor } from '@/lib/canonicalCategory';
import { EVENT_LIST_SELECT, mapEventListRow } from '@/lib/event-list';
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
import { WhyFursatly } from '@/components/home/WhyFursatly';
import { SectionHeader } from '@/components/home/SectionHeader';
import { Reveal } from '@/components/motion/Reveal';
import { SplitText } from '@/components/motion/SplitText';
import { Marquee } from '@/components/motion/Marquee';
import { ScrollRail } from '@/components/motion/ScrollRail';
import { Parallax } from '@/components/motion/Parallax';
import { HeroBackground } from '@/components/motion/HeroBackground';
import { SuzaniRule } from '@/components/brand/SuzaniRule';

// ── Animated counter (fires when scrolled into view) ────────────────────────
function AnimatedCounter({ target, suffix = '', label }: { target: number; suffix?: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const inc = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + inc, target);
          setCount(Math.floor(current));
          if (current >= target) clearInterval(timer);
        }, 1400 / steps);
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center md:text-left">
      <div className="font-display text-5xl font-bold tabular-nums leading-none tracking-tight md:text-6xl">
        {count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K` : count}{suffix}
      </div>
      <p className="text-eyebrow mt-4 text-muted-foreground">{label}</p>
    </div>
  );
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

// Ticker: category icons (Lucide, matching the rest of the UI — no emoji) and
// destination countries as plain names. Category labels come from `t` so the
// ticker follows the active locale.
const TICKER_ICONS: Record<string, LucideIcon> = {
  Scholarships: GraduationCap,
  Competitions: Trophy,
  'Summer Programs': Sun,
  Research: FlaskConical,
  Volunteer: HeartHandshake,
  STEM: Cpu,
  Internships: Briefcase,
  Workshops: BookOpen,
};
const TICKER_COUNTRIES = ['USA', 'UK', 'Germany', 'South Korea', 'Japan', 'Türkiye', 'France'];

/**
 * Client half of the homepage. The server page (./page.tsx) fetches the
 * trimmed events list with ISR and passes it as `initialEvents`, so the first
 * paint shows real cards instead of a spinner; filters and polling then
 * re-fetch client-side exactly as before.
 */
export default function HomeClient({ initialEvents = null }: { initialEvents?: any[] | null }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const supabase = useDb();

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  // ── Filter state (unchanged contract) ────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState([0, 100]);
  const [filterFunding, setFilterFunding] = useState<'All' | 'Full' | 'Partial'>('All');
  const [filterDeadline, setFilterDeadline] = useState<'All' | 'week' | 'month' | '3months'>('All');

  const categories = [
    { id: 'Scholarships', labelKey: 'catScholarships' },
    { id: 'Competitions', labelKey: 'catCompetitions' },
    { id: 'Summer Programs', labelKey: 'catSummerPrograms' },
    { id: 'Research', labelKey: 'catResearch' },
    { id: 'Volunteer', labelKey: 'catVolunteer' },
    { id: 'STEM', labelKey: 'catSTEM' },
    { id: 'Internships', labelKey: 'catInternships' },
    { id: 'Workshops', labelKey: 'catWorkshops' },
  ] as const;

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
    const nowMs = now?.getTime() ?? Date.now();
    return dbEvents.filter((event) => {
      if (event.deadline) {
        const dl = new Date(event.deadline).getTime();
        if (dl < nowMs) return false;
        if (filterDeadline !== 'All') {
          const win = filterDeadline === 'week' ? 7 * 86400_000 : filterDeadline === 'month' ? 30 * 86400_000 : 90 * 86400_000;
          if (dl > nowMs + win) return false;
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
  }, [dbEvents, ageRange, searchTerm, now, filterFunding, filterDeadline, filterLocation, filterLanguage]);

  const closingSoonEvents = React.useMemo(() => {
    if (!dbEvents || !now) return [];
    const nowMs = now.getTime();
    const week = 7 * 86400_000;
    return dbEvents
      .filter((e) => e.deadline && new Date(e.deadline).getTime() > nowMs && new Date(e.deadline).getTime() < nowMs + week)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 10);
  }, [dbEvents, now]);

  const groupedEvents = React.useMemo(() => {
    if (activeCategory) return null;
    const groups: Record<string, any[]> = {};
    filteredEvents.forEach((e) => {
      (groups[canonicalSource(e.source)] ||= []).push(e);
    });
    return groups;
  }, [filteredEvents, activeCategory]);

  // Floating hero cards. In "All" mode → one featured post per category (the
  // "catalog difference"). With a category selected → several posts from THAT
  // category, so the hero mirrors the current selection instead of a lone card.
  const floatingCards = React.useMemo(() => {
    if (!dbEvents) return [];
    const seen = new Set<string>();
    const out: { id: string; title: string; category: string; hue: string }[] = [];
    for (const e of dbEvents) {
      const cat = canonicalSource(e.source);
      if (!activeCategory && seen.has(cat)) continue; // dedupe per-category only in "All" mode
      seen.add(cat);
      const title = (locale !== 'en' && e.research_data?.translations?.[locale]?.title) || e.title;
      out.push({ id: e.id, title, category: translateSource(cat, t), hue: catHue(cat) });
      if (out.length >= 6) break;
    }
    return out;
  }, [dbEvents, locale, t, activeCategory]);

  const getDaysLeft = (deadline: string) =>
    now && deadline ? Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86400_000) : null;

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

  const open = (id: string) => router.push(`/event/${id}`);

  // Browse vs. searching: once the user narrows anything, results matter more
  // than the brand story, so the two swap places in the layout below.
  const isFiltering = searchTerm.trim() !== '' || activeFilterCount > 0 || activeCategory !== null;

  // Scroll to the results. Programmatic scroll routes through Lenis (native
  // scrollIntoView fights its rAF loop); `force` overrides Lenis' own guards.
  const scrollToResults = () => {
    const el = document.getElementById('opportunities');
    if (!el) return;
    const lenis = (window as any).lenis;
    if (lenis?.scrollTo) lenis.scrollTo(el, { offset: -96, force: true });
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Reveal the results when the filter sheet closes. The sheet's scroll-lock
  // (react-remove-scroll) freezes scrolling AND clamps a too-early scroll, so we
  // poll a few frames until the lock lifts, then scroll (giving up after ~1s).
  const onFilterOpenChange = (open: boolean) => {
    if (open) return;
    const start = performance.now();
    const waitThenScroll = () => {
      const locked = document.body.style.overflow === 'hidden';
      if (locked && performance.now() - start < 1000) { requestAnimationFrame(waitThenScroll); return; }
      scrollToResults();
    };
    requestAnimationFrame(waitThenScroll);
  };

  // Swapping large sections invalidates ScrollTrigger's cached positions.
  React.useEffect(() => {
    let cancelled = false;
    import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => { if (!cancelled) ScrollTrigger.refresh(); });
    return () => { cancelled = true; };
  }, [isFiltering]);

  const feats = [
    { title: t.feat1Title, keywords: t.feat1Keys },
    { title: t.feat2Title, keywords: t.feat2Keys },
    { title: t.feat3Title, keywords: t.feat3Keys },
    { title: t.feat4Title, keywords: t.feat4Keys },
  ];

  // ── Filter panel (Sheet body) ────────────────────────────────────────────
  const chip = (active: boolean) =>
    `h-11 rounded-lg border px-4 text-sm font-medium transition-colors ${
      active ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40'
    }`;

  // Filter-panel chip: filled-but-quiet when idle, teal-accent when selected.
  // outline-none + focus-visible ring = brand-teal keyboard focus, no stray UA
  // outline when the sheet auto-focuses the first chip on open.
  const fchip = (active: boolean) =>
    `flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
      active
        ? 'border-accent bg-accent/10 font-semibold text-accent'
        : 'border-border bg-secondary/40 text-muted-foreground hover:border-foreground/25 hover:text-foreground'
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
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold tabular-nums">{ageRange[0]}–{ageRange[1]}</span>
        </div>
        <Slider max={100} step={1} minStepsBetweenThumbs={1} value={ageRange} onValueChange={setAgeRange} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{ageRange[0]} {t.minAge}</span>
          <span>{ageRange[1]} {t.maxAge}</span>
        </div>
      </div>
    </div>
  );

  const gridCards = (events: any[]) => (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event, i) => (
        <Reveal key={event.id} className="h-full" delay={(i % 3) * 0.06}>
          <div className="h-full">
            <EventCard event={event} t={t} locale={locale} now={now} onOpen={() => open(event.id)} hue={catHue(event.source)} />
          </div>
        </Reveal>
      ))}
    </div>
  );

  // Horizontal scroll-driven rail — posts slide sideways as you scroll past.
  const railCards = (events: any[], hue: string) => (
    <ScrollRail>
      {events.map((event) => (
        <div key={event.id} className="w-[270px] shrink-0 sm:w-[310px] md:w-[350px]">
          <EventCard event={event} t={t} locale={locale} now={now} onOpen={() => open(event.id)} hue={hue} />
        </div>
      ))}
    </ScrollRail>
  );

  // Mission and the results list swap order with isFiltering (see below), so
  // both are defined once and referenced in each ordering.
  const missionSection = (
    <section className="container py-28 md:py-40">
          <SectionHeader label={t.missionLead} index="01" title={t.missionTitle} titleClassName="max-w-[20ch]" />
          <Reveal delay={0.15}>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">{t.missionBody}</p>
          </Reveal>
          <Parallax speed={28}><SuzaniRule className="mt-16" /></Parallax>
        </section>
  );

  const exploreSection = (
    <section id="opportunities" className="container scroll-mt-24 py-16">
          <SectionHeader
            label={t.exploreLead}
            index="03"
            title={t.exploreTitle}
            subtitle={dbEvents ? `${filteredEvents.length} / ${dbEvents.length}` : undefined}
            className="mb-12"
          />

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
              <p className="mt-5 text-sm text-muted-foreground">{t.loading}</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-28 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="mt-5 text-lg font-medium text-muted-foreground">{t.noEvents}</p>
              {(searchTerm || activeFilterCount > 0 || activeCategory) && (
                <Button variant="link" className="mt-2 text-accent" onClick={() => { resetFilters(); setActiveCategory(null); }}>
                  {t.clearFilters}
                </Button>
              )}
            </div>
          ) : activeCategory ? (
            <div className="space-y-10">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: `hsl(${catHue(activeCategory)})` }} />
                  <h3 className="truncate font-display text-xl font-semibold sm:text-2xl md:text-3xl">{translateSource(activeCategory, t)}</h3>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 px-2 sm:px-3" onClick={() => setActiveCategory(null)}>
                  <X className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">{t.closeCategory}</span>
                </Button>
              </div>
              {gridCards(filteredEvents)}
            </div>
          ) : (
            <div className="space-y-24">
              {Object.entries(groupedEvents || {})
                .sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : 0))
                .map(([cat, events]) => {
                  const hue = catHue(cat);
                  return (
                    <div key={cat} className="space-y-8">
                      <Parallax speed={14}>
                        <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: `hsl(${hue})` }} />
                            <h3 className="truncate font-display text-xl font-semibold sm:text-2xl md:text-3xl">{translateSource(cat, t)}</h3>
                            <span className="text-eyebrow shrink-0 font-semibold" style={{ color: `hsl(${hue})` }}>{events.length}</span>
                          </div>
                          <Button variant="ghost" size="sm" className="group shrink-0 px-2 sm:px-3" style={{ color: `hsl(${hue})` }} onClick={() => setActiveCategory(cat)}>
                            <span className="hidden sm:inline">{t.viewAll}</span> <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 sm:ml-2" />
                          </Button>
                        </div>
                      </Parallax>
                      {railCards(events.slice(0, 8), hue)}
                    </div>
                  );
                })}
            </div>
          )}
        </section>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />

      <main className="flex-1">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="grain relative flex min-h-screen items-center overflow-hidden">
          <HeroBackground />
          <FloatingCards cards={floatingCards} onOpen={open} />
          <div className="container relative z-10 pb-20 pt-28">
            <div className="mb-6 flex items-center gap-3">
              <span className="text-eyebrow text-accent">{t.heroKicker}</span>
            </div>
            <h1 className="text-hero max-w-[13ch] font-display font-bold">
              <SplitText text={t.heroTitle} delay={0.1} />
            </h1>
            <Reveal delay={0.35} className="mt-8 max-w-xl">
              <p className="text-lg leading-relaxed text-muted-foreground md:text-2xl">{t.heroSubtitle}</p>
            </Reveal>

            <Reveal delay={0.5} className="mt-10 max-w-xl">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="h-14 rounded-lg border-border bg-background/70 pl-12 text-base backdrop-blur-md"
                  />
                </div>
                <Sheet onOpenChange={onFilterOpenChange}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="relative h-14 w-14 rounded-lg border-border bg-background/70 backdrop-blur-md">
                      <SlidersHorizontal className="h-5 w-5" />
                      {activeFilterCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
                    <SheetHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
                      <SheetTitle className="font-display text-xl">{t.filterTitle}</SheetTitle>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground">{filteredEvents.length}</span> {t.resultsLabel}
                      </p>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      {renderFilterPanel()}
                    </div>
                    <div className="flex items-center gap-3 border-t border-border p-4">
                      <Button variant="outline" className="flex-1" onClick={resetFilters} disabled={activeFilterCount === 0}>
                        <X className="mr-2 h-4 w-4" /> {t.resetAll}
                      </Button>
                      <SheetClose asChild>
                        <Button className="flex-1">{t.showResults}</Button>
                      </SheetClose>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => setActiveCategory(null)} className={`${chip(activeCategory === null)} inline-flex items-center gap-2`}>
                  <Sparkles className="h-4 w-4" aria-hidden /> {t.catAll}
                </button>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setActiveCategory(c.id)} className={chip(activeCategory === c.id)}>
                    {t[c.labelKey]}
                  </button>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="text-eyebrow absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-muted-foreground">
            {t.scroll}
            <span className="h-12 w-px animate-pulse bg-gradient-to-b from-accent to-transparent" />
          </div>
        </section>

        {/* ── MARQUEE ──────────────────────────────────────────────────── */}
        <section className="border-y border-border py-3">
          <Marquee
            items={[
              ...categories.map(({ id, labelKey }) => {
                const Icon = TICKER_ICONS[id];
                return (
                  <span className="flex items-center gap-2.5 px-6 py-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 text-accent/80" aria-hidden />
                    {t[labelKey]}<span className="ml-6 text-accent">/</span>
                  </span>
                );
              }),
              ...TICKER_COUNTRIES.map((name) => (
                <span className="flex items-center px-6 py-2 text-sm text-muted-foreground">
                  {name}<span className="ml-6 text-accent">/</span>
                </span>
              )),
            ]}
          />
        </section>

        {/* ── MISSION + RESULTS (swap when filtering) ──────────────────── */}
        {isFiltering ? (
          <>
            {exploreSection}
            {missionSection}
          </>
        ) : (
          <>
            {missionSection}
        {/* ── CLOSING SOON ─────────────────────────────────────────────── */}
        {closingSoonEvents.length > 0 && (
          <section className="container py-14">
            <div className="mb-8 flex items-center gap-3">
              <Flame className="h-5 w-5 text-urgent" />
              <h2 className="text-eyebrow font-semibold text-urgent">{t.closingSoon}</h2>
              <span className="text-eyebrow text-muted-foreground">{closingSoonEvents.length}</span>
            </div>
            <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-3">
              {closingSoonEvents.map((event) => {
                const daysLeft = getDaysLeft(event.deadline);
                const tr = event.research_data?.translations?.[locale];
                const title = (locale !== 'en' && tr?.title) ? tr.title : event.title;
                return (
                  <button
                    key={event.id}
                    onClick={() => open(event.id)}
                    className="group w-72 shrink-0 rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-1 hover:border-urgent/50"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-eyebrow text-muted-foreground">{translateSource(event.source || 'Other', t)}</span>
                      <span className="text-eyebrow font-semibold text-urgent">{daysLeft}{t.dLeft}</span>
                    </div>
                    <p className="line-clamp-2 font-display text-base font-semibold leading-snug group-hover:text-accent">{title}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{event.location || '—'}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
            {exploreSection}
          </>
        )}

        {/* ── STATS ────────────────────────────────────────────────────── */}
        <section className="border-y border-border py-24">
          <div className="container grid grid-cols-2 gap-12 md:grid-cols-4">
            <AnimatedCounter target={dbEvents?.length || 120} label={t.statOpportunities} />
            <AnimatedCounter target={40} suffix="+" label={t.statCountries} />
            <AnimatedCounter target={12000} suffix="+" label={t.statStudents} />
            <AnimatedCounter target={3} label={t.statLanguages} />
          </div>
        </section>

        {/* ── VALUE PROPS ──────────────────────────────────────────────── */}
        <WhyFursatly lead={t.valuesLead} index="02" title={t.whyFursatly} start={t.pipelineStart} via={t.pipelineVia} end={t.pipelineEnd} stages={feats} />

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="container py-28">
          <div className="grain relative overflow-hidden rounded-2xl border border-border bg-card p-12 text-center md:p-20">
            <Reveal><h2 className="text-display font-display font-semibold">{t.ctaTitle}</h2></Reveal>
            <Reveal delay={0.1}><p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">{t.ctaDesc}</p></Reveal>
            <Reveal delay={0.2}>
              <a
                href="https://t.me/fursatly"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-10 inline-flex h-14 items-center gap-2 rounded-lg bg-primary px-8 font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                <Send className="h-5 w-5" /> {t.ctaButton}
              </a>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter t={t} onCategory={setActiveCategory} />
    </div>
  );
}
