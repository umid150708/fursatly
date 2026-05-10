"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  MapPin,
  Calendar,
  User,
  Languages,
  ArrowRight,
  Filter as FilterIcon,
  Loader2,
  SlidersHorizontal,
  X,
  Banknote,
  Clock,
  ShieldCheck,
  Zap,
  Globe2,
  Flame,
} from 'lucide-react';
import { UzbekMotif, AtrasHeader, DoppiIcon, SuzaniMedallion } from '@/components/UzbekMotif';
import { UzbekPatternBorderTop, UzbekPatternBorderMiddle, UzbekPatternBorderBottom, UzbekBackgroundPattern } from '@/components/UzbekPatternBorder';
import { useDb } from '@/supabase';
import { useCollection } from '@/supabase/use-collection';
import { translateSource, translateLanguage } from '@/lib/translations';

// ─── Animated counter (triggers when scrolled into view) ────────────────────
function AnimatedCounter({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1400;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + increment, target);
          setCount(Math.floor(current));
          if (current >= target) clearInterval(timer);
        }, duration / steps);
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center px-4">
      <div className="text-5xl md:text-6xl font-black font-headline tabular-nums leading-none">
        {count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K` : count}{suffix}
      </div>
      <p className="text-sm uppercase tracking-widest mt-3 opacity-60 font-bold">{label}</p>
    </div>
  );
}

// ─── Source ticker items ─────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { icon: '🎓', name: 'Scholarships' },
  { icon: '🏆', name: 'Competitions' },
  { icon: '☀️', name: 'Summer Programs' },
  { icon: '🔬', name: 'Research' },
  { icon: '🤝', name: 'Volunteer' },
  { icon: '💻', name: 'STEM' },
  { icon: '💼', name: 'Internships' },
  { icon: '📚', name: 'Workshops' },
  { icon: '🌍', name: 'Fellowship' },
  { icon: '🇺🇸', name: 'USA' },
  { icon: '🇬🇧', name: 'UK' },
  { icon: '🇩🇪', name: 'Germany' },
  { icon: '🇰🇷', name: 'South Korea' },
  { icon: '🇨🇳', name: 'China' },
  { icon: '🇹🇷', name: 'Turkey' },
  { icon: '🇯🇵', name: 'Japan' },
  { icon: '🇫🇷', name: 'France' },
  { icon: '🇦🇪', name: 'UAE' },
];

export default function Home() {
  const { t, locale, isMounted } = useLanguage();
  const router = useRouter();
  const supabase = useDb();

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState([0, 100]);
  const [filterFunding, setFilterFunding] = useState<'All' | 'Full' | 'Partial'>('All');
  const [filterDeadline, setFilterDeadline] = useState<'All' | 'week' | 'month' | '3months'>('All');

  const categories = [
    { id: 'Scholarships',    icon: '🎓', labelKey: 'catScholarships'   },
    { id: 'Competitions',    icon: '🏆', labelKey: 'catCompetitions'   },
    { id: 'Summer Programs', icon: '☀️', labelKey: 'catSummerPrograms' },
    { id: 'Research',        icon: '🔬', labelKey: 'catResearch'       },
    { id: 'Volunteer',       icon: '🤝', labelKey: 'catVolunteer'      },
    { id: 'STEM',            icon: '💻', labelKey: 'catSTEM'           },
    { id: 'Internships',     icon: '💼', labelKey: 'catInternships'    },
    { id: 'Workshops',       icon: '📚', labelKey: 'catWorkshops'      },
  ];

  const eventsQueryFn = useCallback(() => {
    if (!supabase) return Promise.resolve({ data: null, error: null });
    // Select the columns that exist in the current DB schema.
    // funding_type is stored inside research_data.funding_type (no separate column needed).
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

  const { data: dbEvents, isLoading } = useCollection(supabase, eventsQueryFn, 'events-realtime', 'events');

  const filteredEvents = React.useMemo(() => {
    if (!dbEvents) return [];
    const nowMs = now?.getTime() ?? Date.now();
    return dbEvents
      .filter(event => {
        if (event.deadline) {
          const dl = new Date(event.deadline).getTime();
          if (dl < nowMs) return false;
          if (filterDeadline !== 'All') {
            const windowMs = filterDeadline === 'week' ? 7*86400_000 : filterDeadline === 'month' ? 30*86400_000 : 90*86400_000;
            if (dl > nowMs + windowMs) return false;
          }
        }
        // Age filter: skip if both are sentinel defaults (no real requirement set)
        const hasAgeFilter = ageRange[0] > 0 || ageRange[1] < 100;
        const matchesAge = !hasAgeFilter || (
          (event.age_min >= ageRange[0] && event.age_min <= ageRange[1]) ||
          (event.age_max >= ageRange[0] && event.age_max <= ageRange[1]) ||
          (event.age_min <= ageRange[0] && event.age_max >= ageRange[1])
        );
        const title = (event.title || '').toLowerCase();
        const desc  = (event.description || '').toLowerCase();
        const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase());
        // funding_type is now a DB column set during enrichment — no client-side scan
        const matchesFunding = filterFunding === 'All' || (event.research_data as any)?.funding_type === filterFunding;
        return matchesAge && matchesSearch && matchesFunding;
      });
      // Sort is handled by the DB query (ORDER BY created_at DESC)
  }, [dbEvents, ageRange, searchTerm, now, filterFunding, filterDeadline]);

  // Events closing within 7 days
  const closingSoonEvents = React.useMemo(() => {
    if (!dbEvents || !now) return [];
    const nowMs = now.getTime();
    const sevenDays = 7 * 86400_000;
    return dbEvents
      .filter(e => e.deadline && new Date(e.deadline).getTime() > nowMs && new Date(e.deadline).getTime() < nowMs + sevenDays)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 12);
  }, [dbEvents, now]);

  const groupedEvents = React.useMemo(() => {
    if (activeCategory) return null;
    const groups: Record<string, any[]> = {};
    filteredEvents.forEach(e => {
      const cat = e.source || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    return groups;
  }, [filteredEvents, activeCategory]);

  const getDaysLeft = (deadline: string) => {
    if (!now || !deadline) return null;
    return Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86400_000);
  };

  const renderEventCard = (event: any) => {
    const isLocal = event.location?.toLowerCase().includes('uz') || event.location?.toLowerCase().includes('uzbekistan');
    // funding_type is stored inside research_data (no separate column needed)
    const funding = (event.research_data?.funding_type ?? null) as string | null;
    const displayTitle = (locale === 'uz' ? event.research_data?.translations?.uz?.title :
                          locale === 'ru' ? event.research_data?.translations?.ru?.title : null)
                         ?? event.title;
    const displayDesc  = event.description;
    const daysLeft = event.deadline ? getDaysLeft(event.deadline) : null;
    const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

    return (
      <UzbekMotif key={event.id} className="h-full" isLocal={isLocal}>
        <Card
          className="border border-primary/10 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full bg-background group/card rounded-3xl cursor-pointer hover:-translate-y-1"
          onClick={() => router.push(`/event/${event.id}`)}
        >
          <CardHeader className="pb-3 pt-7 px-7">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {translateSource(event.source || 'Other', t)}
              </Badge>
              <div className="flex items-center gap-2">
                {isUrgent && (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-500 text-white animate-pulse">
                    🔥 {daysLeft}{t.daysLeft}
                  </span>
                )}
                {funding && (
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    funding === 'Full' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                  }`}>
                    {funding === 'Full' ? `✅ ${t.fullyFunded}` : `🔶 ${t.partial}`}
                  </span>
                )}
              </div>
            </div>
            <CardTitle className="text-xl font-bold leading-snug group-hover/card:text-primary transition-colors line-clamp-2">
              {displayTitle}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-sm mt-2 leading-relaxed">
              {displayDesc}
            </CardDescription>
          </CardHeader>

          <CardContent className="mt-auto px-7 pb-7 space-y-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
                <span className="truncate">{event.location || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-primary/60" />
                <span>
                  {isMounted && event.deadline
                    ? `${new Date(event.deadline).getDate().toString().padStart(2,'0')}/${(new Date(event.deadline).getMonth()+1).toString().padStart(2,'0')}/${new Date(event.deadline).getFullYear()}`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-primary/60" />
                <span>
                  {(event.age_min === 0 && event.age_max === 100)
                    ? (t as any).anyAge ?? 'Any age'
                    : `${event.age_min}–${event.age_max} ${t.years}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 shrink-0 text-primary/60" />
                <span>{translateLanguage(event.language, t)}</span>
              </div>
            </div>

            <Button
              className="w-full gap-2 h-11 rounded-2xl font-bold text-base group-hover/card:bg-primary/90 transition-all"
              onClick={e => { e.stopPropagation(); router.push(`/event/${event.id}`); }}
            >
              {t.moreInfo}
              <ArrowRight className="h-4 w-4 transition-transform group-hover/card:translate-x-1" />
            </Button>
          </CardContent>
        </Card>
      </UzbekMotif>
    );
  };

  const isUzbek = isMounted && locale === 'uz';

  const [legalModal, setLegalModal] = useState<null | 'privacy' | 'terms' | 'cookies' | 'about'>(null);

  const LEGAL_CONTENT = {
    privacy: {
      title: 'Privacy Policy',
      body: `Last updated: May 2025

Fursatly ("we", "our", "us") respects your privacy. This policy explains what data we collect and how we use it.

**What we collect**
• Account information (email, name) when you sign in
• Usage data (pages visited, searches made) to improve recommendations
• Device information (browser type, language preference)

**How we use it**
• To show you relevant opportunities based on your age and interests
• To remember your language preference
• To send you deadline reminders (only if you opt in)

**What we don't do**
• We never sell your personal data to third parties
• We never share your data with event organizers without your consent
• We don't use your data for advertising

**Data storage**
All data is stored securely in Supabase (EU region). You can request deletion of your account and all associated data at any time by contacting us.

**Contact**
For privacy concerns: privacy@fursatly.uz`,
    },
    terms: {
      title: 'Terms of Use',
      body: `Last updated: May 2025

By using Fursatly, you agree to these terms.

**The platform**
Fursatly is a free platform that aggregates publicly available youth opportunities — scholarships, competitions, internships, and programs. We curate and translate this information to make it accessible to Uzbek youth.

**Your responsibilities**
• You must be at least 13 years old to use Fursatly
• You agree not to misuse the platform (spam, scraping, abuse)
• You understand that opportunity details come from third-party sources — always verify with the official website before applying

**Our responsibilities**
• We strive to keep information accurate and up to date
• We are not responsible for outcomes of applications made through opportunities listed here
• We do not guarantee admission, selection, or any result from any opportunity

**Intellectual property**
The Fursatly name, logo, and design are our property. Opportunity content belongs to the respective organizations.

**Changes**
We may update these terms. Continued use of the platform means you accept any updates.

**Contact**
legal@fursatly.uz`,
    },
    cookies: {
      title: 'Cookie Policy',
      body: `Last updated: May 2025

Fursatly uses a minimal set of cookies to make the site work properly.

**Essential cookies (always active)**
• Session token — keeps you logged in
• Language preference — remembers whether you chose Uzbek, Russian, or English
• Theme preference — remembers light/dark mode

**Analytics cookies (optional)**
• We may use anonymous analytics to understand how people use the site (e.g. which categories are most popular). No personal data is included.

**What we don't use**
• No advertising cookies
• No third-party tracking cookies
• No social media tracking pixels

**Managing cookies**
You can clear cookies any time through your browser settings. Clearing session cookies will log you out.

**Contact**
cookies@fursatly.uz`,
    },
    about: {
      title: 'About Fursatly',
      body: `Fursatly (from Uzbek: "fursatli" — opportune, timely) is a platform built for Uzbek youth to discover the world's best opportunities.

**Our mission**
Every year, thousands of scholarships, competitions, internships, and programs go unfilled — not because there aren't qualified applicants, but because young people simply don't know they exist. Fursatly fixes that.

**What we do**
• We aggregate opportunities from hundreds of sources worldwide
• We use AI to research each opportunity in depth — eligibility, tips, resources
• We translate everything into Uzbek and Russian so language is never a barrier
• We surface closing deadlines so you never miss out

**Who we are**
Fursatly was built by a small team who believe that access to opportunity shouldn't depend on which country you were born in or what language you speak.

**The name**
In Uzbek, "fursat" means opportunity or chance. "Fursatly" means being in the right place at the right time — which is exactly what we help you do.

**Get in touch**
hello@fursatly.uz`,
    },
  };

  const activeFilterCount =
    (filterLocation !== 'All' ? 1 : 0) +
    (filterLanguage !== 'All' ? 1 : 0) +
    (ageRange[0] > 0 || ageRange[1] < 100 ? 1 : 0) +
    (filterFunding !== 'All' ? 1 : 0) +
    (filterDeadline !== 'All' ? 1 : 0);

  const renderFilterPanel = () => (
    <div className="flex flex-col h-full">
      <div className="space-y-10 flex-1">
        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">{t.location}</label>
          <div className="grid grid-cols-2 gap-3">
            {['All', 'UK', 'UZ', 'RU'].map(loc => (
              <Button key={loc} variant={filterLocation === loc ? 'default' : 'outline'} size="sm"
                className={`rounded-2xl h-12 font-bold transition-all ${filterLocation === loc && isUzbek ? 'bg-secondary hover:bg-secondary/90' : ''}`}
                onClick={() => setFilterLocation(loc)}>
                {loc === 'All' ? t.all : loc}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">{t.language}</label>
          <div className="grid grid-cols-2 gap-3">
            {['All', 'English', 'Uzbek', 'Russian'].map(lang => (
              <Button key={lang} variant={filterLanguage === lang ? 'default' : 'outline'} size="sm"
                className={`rounded-2xl h-12 font-bold transition-all ${filterLanguage === lang && isUzbek ? 'bg-secondary hover:bg-secondary/90' : ''}`}
                onClick={() => setFilterLanguage(lang)}>
                {lang === 'All' ? t.all : lang === 'English' ? 'EN' : lang === 'Uzbek' ? 'UZ' : 'RU'}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2 block">
            <Banknote className="h-4 w-4" /> {t.fundingCoverage}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[{id:'All',label:t.fundingAny,emoji:'🌐'},{id:'Full',label:t.fundingFull,emoji:'✅'},{id:'Partial',label:t.fundingPartial,emoji:'🔶'}].map(opt => (
              <Button key={opt.id} variant={filterFunding === opt.id ? 'default' : 'outline'} size="sm"
                className="rounded-2xl h-12 font-bold transition-all flex-col gap-0.5 text-xs"
                onClick={() => setFilterFunding(opt.id as any)}>
                <span>{opt.emoji}</span><span>{opt.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2 block">
            <Clock className="h-4 w-4" /> {t.deadline}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[{id:'All',label:t.deadlineAny},{id:'week',label:t.deadlineWeek},{id:'month',label:t.deadlineMonth},{id:'3months',label:t.deadline3Months}].map(opt => (
              <Button key={opt.id} variant={filterDeadline === opt.id ? 'default' : 'outline'} size="sm"
                className="rounded-2xl h-12 font-bold transition-all"
                onClick={() => setFilterDeadline(opt.id as any)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block">{t.age}</label>
          <div className="px-2">
            <Slider max={100} step={1} minStepsBetweenThumbs={1} value={ageRange} onValueChange={setAgeRange}
              className={isUzbek ? "[&_[role=slider]]:bg-secondary" : ""} />
          </div>
          <div className="flex justify-between text-sm font-bold opacity-60">
            <span>{ageRange[0]} {t.minAge}</span>
            <span>{ageRange[1]} {t.maxAge}</span>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <Button variant="ghost" className="w-full text-muted-foreground font-bold"
            onClick={() => { setFilterLocation('All'); setFilterLanguage('All'); setSearchTerm(''); setAgeRange([0,100]); setFilterFunding('All'); setFilterDeadline('All'); }}>
            <X className="mr-2 h-4 w-4" /> {t.resetAll}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col min-h-screen relative ${isUzbek ? 'uzbek-suzani-bg' : ''}`}>
      <div className="relative z-10">
        <AtrasHeader />

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav className={`sticky top-0 z-50 w-full transition-all duration-300 ${isUzbek ? 'bg-background/95 border-b-4 border-accent' : 'bg-background/80 backdrop-blur-md border-b'}`}>
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${isUzbek ? 'bg-primary scale-110 shadow-lg shadow-primary/20' : 'bg-primary'}`}>
              <DoppiIcon className="h-10 w-10" />
            </div>
            <span className={`text-3xl font-bold font-headline tracking-tight ${isUzbek ? 'text-primary' : 'text-foreground'}`}>Fursatly</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      <main className="flex-1">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className={`relative py-32 overflow-hidden transition-all duration-500 ${isUzbek ? 'uzbek-suzani-bg' : 'bg-muted/10'}`}>
          {isUzbek && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Top decorative border — thin teal + gold line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e7e8c] via-[#c89b3c] to-[#1e7e8c]" />
              {/* Bottom decorative border */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e7e8c] via-[#c89b3c] to-[#1e7e8c]" />
            </div>
          )}
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="max-w-4xl mx-auto">
              <Badge variant="outline" className={`mb-8 px-6 py-2 text-sm tracking-widest uppercase border-primary/40 text-primary font-bold rounded-full ${isUzbek ? 'bg-white/50 backdrop-blur-sm' : ''}`}>
                {isMounted && dbEvents ? `${dbEvents.length} ${t.activeEvents}` : t.activeEvents}
              </Badge>
              <h1 className={`text-6xl md:text-9xl font-bold font-headline leading-none mb-10 transition-colors ${isUzbek ? 'text-primary' : ''}`}>
                {t.heroTitle}
              </h1>
              <p className="text-xl md:text-3xl text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed">
                {t.heroSubtitle}
              </p>

              <div className="max-w-2xl mx-auto flex gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-7 w-7 text-foreground" />
                  <Input
                    placeholder={t.searchPlaceholder}
                    className={`pl-14 h-20 text-2xl rounded-3xl bg-background shadow-2xl transition-all ${isUzbek ? 'border-primary/30 focus:border-primary focus:ring-primary/20' : 'border-primary/10'}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="h-20 w-20 rounded-3xl shadow-2xl relative transition-all border-primary/20 hover:bg-primary/5">
                      <SlidersHorizontal className="h-8 w-8 text-foreground" />
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-2 -right-2 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold border-4 border-background">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className={`w-full sm:w-[400px] flex flex-col ${isUzbek ? 'uzbek-suzani-bg border-l-8 border-secondary' : ''}`}>
                    <SheetHeader className="mb-10">
                      <SheetTitle className="text-3xl font-headline flex items-center gap-3">
                        <FilterIcon className="text-foreground" /> {t.filterTitle}
                      </SheetTitle>
                    </SheetHeader>
                    {renderFilterPanel()}
                  </SheetContent>
                </Sheet>
              </div>

              {/* Category Quick Filters */}
              <div className="mt-16 flex flex-wrap justify-center gap-4">
                <Button variant={activeCategory === null ? 'default' : 'outline'}
                  className="rounded-2xl h-14 px-8 font-black text-lg transition-all"
                  onClick={() => setActiveCategory(null)}>
                  {t.catAll}
                </Button>
                {categories.map(cat => (
                  <Button key={cat.id} variant={activeCategory === cat.id ? 'default' : 'outline'}
                    className="rounded-2xl h-14 px-8 font-black text-lg transition-all"
                    onClick={() => setActiveCategory(cat.id)}>
                    {cat.icon} {t[cat.labelKey as keyof typeof t]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>



        {/* ── CLOSING SOON ──────────────────────────────────────────────── */}
        {isMounted && closingSoonEvents.length > 0 && (
          <section className="py-16 bg-orange-50/60 dark:bg-orange-950/10 border-y border-orange-200/50 dark:border-orange-900/20">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-3 mb-8">
                <Flame className="h-6 w-6 text-orange-500 animate-pulse" />
                <h2 className="text-2xl font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  {t.closingSoon}
                </h2>
                <Badge className="bg-orange-500 text-white font-bold">{closingSoonEvents.length}</Badge>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
                {closingSoonEvents.map(event => {
                  const daysLeft = getDaysLeft(event.deadline);
                  const tr = event.research_data?.translations?.[locale];
                  const title = (locale !== 'en' && tr?.title) ? tr.title : event.title;
                  return (
                    <div
                      key={event.id}
                      onClick={() => router.push(`/event/${event.id}`)}
                      className="flex-shrink-0 w-72 bg-background rounded-2xl border-2 border-orange-200/60 dark:border-orange-900/40 p-5 cursor-pointer hover:shadow-lg hover:border-orange-400 transition-all hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary" className="text-xs font-bold">
                          {translateSource(event.source || 'Other', t)}
                        </Badge>
                        <span className="text-xs font-black text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full">
                          🔥 {daysLeft}{t.daysLeft}
                        </span>
                      </div>
                      <p className="font-bold text-sm leading-snug line-clamp-2">{title}</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {event.location || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── EVENTS ────────────────────────────────────────────────────── */}
        <section className={`py-24 ${isUzbek ? 'bg-background/40' : 'bg-muted/20'}`}>
          <div className="container mx-auto px-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40">
                <Loader2 className="h-16 w-16 animate-spin text-foreground" />
                <p className="mt-6 text-xl font-bold opacity-40 italic">{t.loading}</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className={`text-center py-32 rounded-[3rem] border-4 border-dashed transition-colors flex flex-col items-center justify-center ${isUzbek ? 'border-primary/20 bg-primary/5' : 'border-primary/10 bg-background'}`}>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${isUzbek ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Search className="h-10 w-10 text-foreground" />
                </div>
                <p className={`text-2xl font-bold mb-4 ${isUzbek ? 'text-primary' : 'text-muted-foreground'}`}>{t.noEvents}</p>
                {(searchTerm !== '' || activeFilterCount > 0 || activeCategory) && (
                  <Button variant="link" className="font-bold text-lg"
                    onClick={() => { setFilterLocation('All'); setFilterLanguage('All'); setAgeRange([0,100]); setSearchTerm(''); setActiveCategory(null); }}>
                    {t.clearFilters}
                  </Button>
                )}
              </div>
            ) : activeCategory ? (
              <div>
                <div className="mb-16 flex items-center justify-between">
                  <h2 className="text-5xl font-headline font-bold">
                    {categories.find(c => c.id === activeCategory)?.icon} {translateSource(activeCategory!, t)}
                  </h2>
                  <Button variant="ghost" className="font-bold" onClick={() => setActiveCategory(null)}>
                    <X className="mr-2" /> {t.closeCategory}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {filteredEvents.map((event) => renderEventCard(event))}
                </div>
              </div>
            ) : (
              <div className="space-y-32">
                {Object.entries(groupedEvents || {})
                  .sort(([a], [b]) => { if (a === 'Other') return 1; if (b === 'Other') return -1; return 0; })
                  .map(([catName, events]) => (
                    <div key={catName} className="space-y-12">
                      <div className="flex items-center justify-between border-b-4 border-primary/10 pb-6">
                        <div className="flex items-center gap-4">
                          <span className="text-4xl">{categories.find(c => c.id === catName)?.icon || '📂'}</span>
                          <h2 className="text-4xl md:text-5xl font-headline font-bold">{translateSource(catName, t)}</h2>
                          <Badge variant="secondary" className="text-lg px-4">{events.length}</Badge>
                        </div>
                        <Button variant="ghost" className="text-primary font-black text-lg group" onClick={() => setActiveCategory(catName)}>
                          {t.viewAll} <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-2" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        {events.slice(0, 3).map((event) => renderEventCard(event))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* ── WHY FURSATLY ──────────────────────────────────────────────── */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-black font-headline text-center mb-16">
              {t.whyFursatly}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: ShieldCheck,      color: 'bg-green-100  dark:bg-green-900/30  text-green-600  dark:text-green-400',  title: t.feat1Title, desc: t.feat1Desc },
                { icon: SlidersHorizontal,color: 'bg-blue-100   dark:bg-blue-900/30   text-blue-600   dark:text-blue-400',   title: t.feat2Title, desc: t.feat2Desc },
                { icon: Zap,              color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', title: t.feat3Title, desc: t.feat3Desc },
                { icon: Globe2,           color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', title: t.feat4Title, desc: t.feat4Desc },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex flex-col items-start gap-4 p-8 rounded-3xl bg-muted/40 hover:bg-muted/70 transition-colors border border-primary/5 hover:border-primary/15">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-black">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


      </main>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0d1117] text-white relative z-20">
        <div className="container mx-auto px-6 pt-16 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-white/10">
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                  <DoppiIcon className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight">Fursatly</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed max-w-xs">{t.footerDesc}</p>
            </div>

            <div className="space-y-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white/40">{t.footerPlatform}</h4>
              <ul className="space-y-3 text-sm text-white/60">
                {[
                  { label: t.footerBrowse,    action: () => setActiveCategory(null)           },
                  { label: t.catScholarships, action: () => setActiveCategory('Scholarships') },
                  { label: t.catCompetitions, action: () => setActiveCategory('Competitions') },
                  { label: t.catInternships,  action: () => setActiveCategory('Internships')  },
                  { label: t.catVolunteer,    action: () => setActiveCategory('Volunteer')    },
                ].map(({ label, action }) => (
                  <li key={label}><button onClick={action} className="hover:text-white transition-colors text-left">{label}</button></li>
                ))}
              </ul>
            </div>

            <div className="space-y-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white/40">{t.footerLegal}</h4>
              <ul className="space-y-3 text-sm text-white/60">
                {([
                  { label: t.footerPrivacy, key: 'privacy'  },
                  { label: t.footerTerms,   key: 'terms'    },
                  { label: t.footerCookies, key: 'cookies'  },
                  { label: t.footerAbout,   key: 'about'    },
                ] as const).map(({ label, key }) => (
                  <li key={key}>
                    <button
                      onClick={() => setLegalModal(key)}
                      className="hover:text-white transition-colors text-left"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
            <span>© {new Date().getFullYear()} Fursatly. {t.footerRights}</span>
            <span>{t.footerTagline}</span>
          </div>
        </div>
      </footer>

      {/* ── LEGAL MODALS ────────────────────────────────────────────────── */}
      <Dialog open={!!legalModal} onOpenChange={() => setLegalModal(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-headline">
              {legalModal && LEGAL_CONTENT[legalModal].title}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pt-2">
            {legalModal && LEGAL_CONTENT[legalModal].body.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-bold text-foreground mt-4 mb-1">{line.replace(/\*\*/g, '')}</p>;
              }
              if (line.startsWith('•')) {
                return <p key={i} className="pl-3 text-muted-foreground">{line}</p>;
              }
              if (line === '') {
                return <div key={i} className="h-2" />;
              }
              return <p key={i}>{line}</p>;
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
