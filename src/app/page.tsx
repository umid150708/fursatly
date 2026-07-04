'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, SlidersHorizontal, ArrowRight, ArrowUpRight, Loader2, X, Flame, Send,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDb } from '@/supabase';
import { useCollection } from '@/supabase/use-collection';
import { translateSource } from '@/lib/translations';
import { catHue } from '@/lib/categoryColor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { EventCard } from '@/components/home/EventCard';
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

const TICKER_ITEMS = [
  '🎓 Scholarships', '🏆 Competitions', '☀️ Summer Programs', '🔬 Research', '🤝 Volunteer',
  '💻 STEM', '💼 Internships', '📚 Workshops', '🌍 Fellowships',
  '🇺🇸 USA', '🇬🇧 UK', '🇩🇪 Germany', '🇰🇷 Korea', '🇯🇵 Japan', '🇹🇷 Türkiye', '🇫🇷 France',
];

export default function Home() {
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

  const eventsQueryFn = useCallback(() => {
    if (!supabase) return Promise.resolve({ data: null, error: null });
    let q = supabase
      .from('events')
      .select('id,title,description,location,deadline,language,age_min,age_max,source,created_at,research_data')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(300);
    if (filterLocation !== 'All') q = q.eq('location', filterLocation);
    if (filterLanguage !== 'All') q = q.eq('language', filterLanguage);
    if (activeCategory) q = q.eq('source', activeCategory);
    return q;
  }, [supabase, filterLocation, filterLanguage, activeCategory]);

  const { data: dbEvents, isLoading } = useCollection(supabase, eventsQueryFn);

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
      return matchesAge && matchesSearch && matchesFunding;
    });
  }, [dbEvents, ageRange, searchTerm, now, filterFunding, filterDeadline]);

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
      const cat = e.source || 'Other';
      (groups[cat] ||= []).push(e);
    });
    return groups;
  }, [filteredEvents, activeCategory]);

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

  const feats = [
    { title: t.feat1Title, desc: t.feat1Desc },
    { title: t.feat2Title, desc: t.feat2Desc },
    { title: t.feat3Title, desc: t.feat3Desc },
    { title: t.feat4Title, desc: t.feat4Desc },
  ];

  // ── Filter panel (Sheet body) ────────────────────────────────────────────
  const chip = (active: boolean) =>
    `h-11 rounded-lg border px-4 text-sm font-medium transition-colors ${
      active ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40'
    }`;

  const renderFilterPanel = () => (
    <div className="space-y-9">
      <div>
        <label className="text-eyebrow mb-3 block text-muted-foreground">{t.location}</label>
        <div className="grid grid-cols-4 gap-2">
          {['All', 'UK', 'UZ', 'RU'].map((loc) => (
            <button key={loc} className={chip(filterLocation === loc)} onClick={() => setFilterLocation(loc)}>
              {loc === 'All' ? t.all : loc}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-eyebrow mb-3 block text-muted-foreground">{t.language}</label>
        <div className="grid grid-cols-4 gap-2">
          {['All', 'English', 'Uzbek', 'Russian'].map((lang) => (
            <button key={lang} className={chip(filterLanguage === lang)} onClick={() => setFilterLanguage(lang)}>
              {lang === 'All' ? t.all : lang === 'English' ? 'EN' : lang === 'Uzbek' ? 'UZ' : 'RU'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-eyebrow mb-3 block text-muted-foreground">{t.fundingCoverage}</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ id: 'All', l: t.fundingAny }, { id: 'Full', l: t.fundingFull }, { id: 'Partial', l: t.fundingPartial }].map((o) => (
            <button key={o.id} className={chip(filterFunding === o.id)} onClick={() => setFilterFunding(o.id as any)}>{o.l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-eyebrow mb-3 block text-muted-foreground">{t.deadline}</label>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: 'All', l: t.deadlineAny }, { id: 'week', l: t.deadlineWeek }, { id: 'month', l: t.deadlineMonth }, { id: '3months', l: t.deadline3Months }].map((o) => (
            <button key={o.id} className={chip(filterDeadline === o.id)} onClick={() => setFilterDeadline(o.id as any)}>{o.l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-eyebrow mb-4 block text-muted-foreground">{t.age}</label>
        <Slider max={100} step={1} minStepsBetweenThumbs={1} value={ageRange} onValueChange={setAgeRange} />
        <div className="mt-3 flex justify-between text-sm text-muted-foreground">
          <span>{ageRange[0]} {t.minAge}</span>
          <span>{ageRange[1]} {t.maxAge}</span>
        </div>
      </div>
      {activeFilterCount > 0 && (
        <Button variant="ghost" className="w-full" onClick={resetFilters}>
          <X className="mr-2 h-4 w-4" /> {t.resetAll}
        </Button>
      )}
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

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />

      <main className="flex-1">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="grain relative flex min-h-screen items-center overflow-hidden">
          <HeroBackground />
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
                <Sheet>
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
                  <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                    <SheetHeader className="mb-8">
                      <SheetTitle className="font-display text-2xl">{t.filterTitle}</SheetTitle>
                    </SheetHeader>
                    {renderFilterPanel()}
                  </SheetContent>
                </Sheet>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => setActiveCategory(null)} className={chip(activeCategory === null)}>{t.catAll}</button>
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
            items={TICKER_ITEMS.map((item) => (
              <span className="flex items-center px-6 py-2 text-sm text-muted-foreground">
                {item}<span className="ml-6 text-accent">/</span>
              </span>
            ))}
          />
        </section>

        {/* ── MISSION ──────────────────────────────────────────────────── */}
        <section className="container py-28 md:py-40">
          <Reveal><p className="text-eyebrow mb-8 text-accent">{t.missionLead}</p></Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-display max-w-[20ch] font-display font-semibold">{t.missionTitle}</h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">{t.missionBody}</p>
          </Reveal>
          <Parallax speed={28}><SuzaniRule className="mt-16" /></Parallax>
        </section>

        {/* ── VALUE PROPS ──────────────────────────────────────────────── */}
        <section className="container py-20">
          <Reveal><p className="text-eyebrow text-accent">{t.valuesLead}</p></Reveal>
          <Reveal delay={0.05}><h2 className="text-display mt-4 font-display font-semibold">{t.whyFursatly}</h2></Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {feats.map((f, i) => (
              <Reveal key={i} className="h-full" delay={i * 0.08}>
                <div className="flex h-full flex-col bg-background p-8">
                  <span className="text-eyebrow font-semibold text-accent">0{i + 1}</span>
                  <h3 className="mt-6 font-display text-xl font-semibold">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── CLOSING SOON ─────────────────────────────────────────────── */}
        {closingSoonEvents.length > 0 && (
          <section className="container py-14">
            <div className="mb-8 flex items-center gap-3">
              <Flame className="h-5 w-5 text-urgent" />
              <h2 className="text-eyebrow font-semibold text-urgent">{t.closingSoon}</h2>
              <span className="text-eyebrow text-muted-foreground">{closingSoonEvents.length}</span>
            </div>
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
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

        {/* ── EXPLORE / EVENTS GRID ────────────────────────────────────── */}
        <section id="opportunities" className="container scroll-mt-24 py-16">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-eyebrow text-accent">{t.exploreLead}</p>
              <h2 className="text-display mt-4 font-display font-semibold">{t.exploreTitle}</h2>
            </div>
            {dbEvents && (
              <span className="text-eyebrow text-muted-foreground">
                {filteredEvents.length} / {dbEvents.length}
              </span>
            )}
          </div>

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
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div className="flex items-center gap-4">
                  <span className="h-7 w-1.5 rounded-full" style={{ background: `hsl(${catHue(activeCategory)})` }} />
                  <h3 className="font-display text-2xl font-semibold md:text-3xl">{translateSource(activeCategory, t)}</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveCategory(null)}>
                  <X className="mr-2 h-4 w-4" /> {t.closeCategory}
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
                      <div className="flex items-center justify-between border-b border-border pb-5">
                        <div className="flex items-center gap-4">
                          <span className="h-7 w-1.5 rounded-full" style={{ background: `hsl(${hue})` }} />
                          <h3 className="font-display text-2xl font-semibold md:text-3xl">{translateSource(cat, t)}</h3>
                          <span className="text-eyebrow font-semibold" style={{ color: `hsl(${hue})` }}>{events.length}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="group" style={{ color: `hsl(${hue})` }} onClick={() => setActiveCategory(cat)}>
                          {t.viewAll} <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </div>
                      {railCards(events.slice(0, 8), hue)}
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* ── STATS ────────────────────────────────────────────────────── */}
        <section className="border-y border-border py-24">
          <div className="container grid grid-cols-2 gap-12 md:grid-cols-4">
            <AnimatedCounter target={dbEvents?.length || 120} label={t.statOpportunities} />
            <AnimatedCounter target={40} suffix="+" label={t.statCountries} />
            <AnimatedCounter target={12000} suffix="+" label={t.statStudents} />
            <AnimatedCounter target={3} label={t.statLanguages} />
          </div>
        </section>

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
