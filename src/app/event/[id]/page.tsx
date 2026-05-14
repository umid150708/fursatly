
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDb } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { translations, translateSource, translateLanguage } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Calendar, 
  User, 
  Languages, 
  ArrowLeft, 
  Globe, 
  BookOpen, 
  Video, 
  CheckCircle2,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { AtrasHeader, UzbekMotif } from '@/components/UzbekMotif';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function EventDetail() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useDb();
  const { locale } = useLanguage();
  const t = translations[locale];
  
  const [event, setEvent] = useState<any>(null);
  const [rawResearch, setRawResearch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Merge locale-specific translations over raw English research data
  // Filter out empty/garbage items from a list
  const cleanList = (items: any[]): any[] => {
    if (!items) return [];
    return items.filter(item => {
      const s = (typeof item === 'string' ? item : item?.text || item?.name || item?.detail || item?.description || '').trim();
      return s.length >= 5;
    });
  };

  const research = useMemo(() => {
    if (!rawResearch || !event) return rawResearch;
    const tr = (locale !== 'en') ? event.research_data?.translations?.[locale] : null;

    const pick = (trField: any[], enField: any[]) => {
      const cleaned = cleanList(trField || []);
      return cleaned.length > 0 ? cleaned : cleanList(enField || []);
    };

    if (!tr) return {
      ...rawResearch,
      keyDetails:  cleanList(rawResearch.keyDetails),
      benefits:    cleanList(rawResearch.benefits),
      eligibility: cleanList(rawResearch.eligibility),
    };

    return {
      ...rawResearch,
      extendedDescription: tr.extendedDescription || rawResearch.extendedDescription,
      // translation stores competitionTips/eligibilityCriteria; mapped fields use benefits/eligibility
      keyDetails:  pick(tr.keyDetails,          rawResearch.keyDetails),
      benefits:    pick(tr.competitionTips,     rawResearch.benefits),
      eligibility: pick(tr.eligibilityCriteria, rawResearch.eligibility),
    };
  }, [rawResearch, event, locale]);

  useEffect(() => {
    async function fetchEvent() {
      if (!supabase || !id) return;

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setEvent(data);

        // Map research_data to expected format
        if (data.research_data) {
          const researchData = data.research_data;

          // Determine which tips field to use based on source
          const tips = researchData.competitionTips || researchData.eventTips || [];

          // Extract official website from resources if not in root level
          let officialWebsite = researchData.officialWebsite;
          let filteredResources = researchData.preparationResources || [];

          if (!officialWebsite && filteredResources.length > 0) {
            // Look for website in resources (old format)
            const websiteResource = filteredResources.find((r: any) =>
              r.type?.toLowerCase().includes('website') ||
              r.title?.toLowerCase().includes('website') ||
              r.title?.toLowerCase().includes('official')
            );
            if (websiteResource) {
              officialWebsite = websiteResource.url;
              // Remove website from resources list
              filteredResources = filteredResources.filter((r: any) => r !== websiteResource);
            }
          }

          // Map to expected format (raw English data)
          const mappedResearch = {
            benefits: tips,
            eligibility: researchData.eligibilityCriteria || [],
            resources: filteredResources,
            officialWebsite: officialWebsite,
            applyLabel: researchData.applyLabel || null,
            extendedDescription: researchData.extendedDescription || null,
            keyDetails: researchData.keyDetails || [],
            verifiedLinks: researchData.verifiedLinks || [],
            commonMistakes: researchData.commonMistakes || [],
            confidence: researchData.confidence,
          };

          setRawResearch(mappedResearch);
        }
      }
      setLoading(false);
    }
    fetchEvent();
  }, [supabase, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold">{t.eventNotFound}</h1>
        <Button onClick={() => router.push('/')}>{t.goHome}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AtrasHeader />

      {/* Nav bar */}
      <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            className="gap-2 hover:bg-primary/10 transition-colors font-bold"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" /> {t.backToOpportunities}
          </Button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Category-themed hero — bold color block, Uzbek-inspired pattern overlay,
                deadline countdown, and emphasised stats. No stock photos. */}
            {(() => {
              const cat = (event.source || 'Other').toLowerCase();
              // Editorial palette — deep, muted, news-publication weight. All Tailwind
              // 800/900/950 shades so the page reads serious, not kid-friendly.
              const palette: Record<string, { from: string; via: string; to: string; ring: string }> = {
                scholarships:      { from: 'from-emerald-900', via: 'via-emerald-950',  to: 'to-slate-950',   ring: 'ring-emerald-700/20' },
                competitions:      { from: 'from-amber-800',   via: 'via-stone-900',    to: 'to-zinc-950',    ring: 'ring-amber-700/20'   },
                'summer programs': { from: 'from-rose-900',    via: 'via-rose-950',     to: 'to-stone-950',   ring: 'ring-rose-800/20'    },
                research:          { from: 'from-blue-950',    via: 'via-slate-900',    to: 'to-slate-950',   ring: 'ring-blue-800/20'    },
                volunteer:         { from: 'from-orange-900',  via: 'via-stone-900',    to: 'to-stone-950',   ring: 'ring-orange-800/20'  },
                stem:              { from: 'from-indigo-950',  via: 'via-violet-950',   to: 'to-slate-950',   ring: 'ring-indigo-800/20'  },
                internships:       { from: 'from-slate-800',   via: 'via-slate-900',    to: 'to-slate-950',   ring: 'ring-slate-700/20'   },
                workshops:         { from: 'from-teal-900',    via: 'via-slate-900',    to: 'to-slate-950',   ring: 'ring-teal-800/20'    },
                other:             { from: 'from-slate-800',   via: 'via-slate-900',    to: 'to-slate-950',   ring: 'ring-slate-700/20'   },
              };
              const p = palette[cat] ?? palette.other;

              const daysLeft = event.deadline
                ? Math.ceil((new Date(event.deadline).getTime() - Date.now()) / 86400_000)
                : null;
              const urgency = daysLeft != null && daysLeft <= 7;

              return (
                <header className={`relative rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ${p.ring} bg-gradient-to-br ${p.from} ${p.via} ${p.to}`}>
                  {/* Uzbek-inspired suzani dot pattern as decorative overlay */}
                  <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id={`suzani-${event.id}`} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <circle cx="30" cy="30" r="2" fill="white" />
                        <circle cx="0"  cy="0"  r="1.5" fill="white" />
                        <circle cx="60" cy="0"  r="1.5" fill="white" />
                        <circle cx="0"  cy="60" r="1.5" fill="white" />
                        <circle cx="60" cy="60" r="1.5" fill="white" />
                        <path d="M30 18 L34 26 L42 30 L34 34 L30 42 L26 34 L18 30 L26 26 Z" fill="white" opacity="0.4" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#suzani-${event.id})`} />
                  </svg>

                  {/* Bright corner glows for depth */}
                  <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-white/15 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-black/15 blur-3xl pointer-events-none" />

                  <div className="relative p-8 md:p-12 lg:p-14 text-white">
                    {/* Top row: category badge + countdown */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-10">
                      <Badge className="bg-white/10 text-white px-4 py-1.5 text-xs font-semibold tracking-[0.18em] uppercase rounded-full ring-1 ring-white/20 backdrop-blur-sm hover:bg-white/15">
                        {translateSource(event.source || 'Other', t)}
                      </Badge>
                      {daysLeft != null && daysLeft >= 0 && (
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase backdrop-blur-sm ring-1 ${urgency ? 'bg-amber-200/15 text-amber-100 ring-amber-200/30' : 'bg-white/10 text-white/90 ring-white/15'}`}>
                          <Calendar className="h-3.5 w-3.5" />
                          {daysLeft === 0 ? (t.deadlineToday || 'Closes today') :
                           daysLeft === 1 ? (t.deadline1Day || '1 day left') :
                           `${daysLeft} ${t.daysLeft || 'days left'}`}
                        </div>
                      )}
                    </div>

                    {/* Title — sized down from 7xl, kept readable */}
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold font-headline leading-[1.1] tracking-tight max-w-3xl">
                      {event.research_data?.translations?.[locale]?.title || event.title}
                    </h1>

                    {/* Organiser byline */}
                    {event.research_data?.organisation && (
                      <p className="mt-5 text-base md:text-lg text-white/85 font-medium">
                        {t.organisedBy || 'Organised by'} <span className="text-white font-semibold">{event.research_data.organisation}</span>
                      </p>
                    )}

                    {/* Inline meta — minimal, separated by a thin divider above */}
                    <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.12em] text-white/70">
                      {event.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {event.location}
                        </span>
                      )}
                      {event.language && (
                        <span className="inline-flex items-center gap-1.5">
                          <Languages className="h-3.5 w-3.5" /> {translateLanguage(event.language, t)}
                        </span>
                      )}
                      {(event.age_min || event.age_max) && (
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" /> {event.age_min ?? '?'}–{event.age_max ?? '?'}
                        </span>
                      )}
                    </div>
                  </div>
                </header>
              );
            })()}

            <div className="space-y-8">
              <h2 className="text-4xl font-bold font-headline border-b-4 border-primary/10 pb-4 inline-block">
                {t.overview}
              </h2>
              <p className="text-2xl text-muted-foreground leading-relaxed whitespace-pre-wrap font-medium">
                {research?.extendedDescription || event.description}
              </p>
            </div>

            {research ? (
              <div className="space-y-16">

                {/* Key Details */}
                {research.keyDetails?.length > 0 && (
                  <div className="bg-primary/5 rounded-[2.5rem] p-12 space-y-8 border-l-8 border-primary">
                    <h3 className="text-3xl font-bold flex items-center gap-4">
                      <CheckCircle2 className="h-8 w-8 text-primary" /> {t.keyDetails}
                    </h3>
                    <ul className="space-y-4">
                      {research.keyDetails.map((detail: any, idx: number) => (
                        <li key={idx} className="flex gap-3 text-xl items-start">
                          <span className="text-primary font-bold mt-1">→</span>
                          {typeof detail === 'string' ? detail : detail?.text || ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {research.benefits?.length > 0 && (
                <div className="bg-primary/5 rounded-[2.5rem] p-12 space-y-8 border-l-8 border-primary">
                   <h3 className="text-3xl font-bold flex items-center gap-4">
                     <CheckCircle2 className="h-8 w-8 text-primary" /> {t.keyBenefits}
                   </h3>
                   <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {research.benefits.map((benefit: any, idx: number) => (
                       <li key={idx} className="flex gap-3 text-xl items-start">
                         <span className="text-primary font-bold">•</span>
                         {typeof benefit === 'string' ? benefit : benefit?.value || benefit?.text || benefit?.detail || benefit?.description || benefit?.name || ''}
                       </li>
                     ))}
                   </ul>
                </div>
                )}

                {research.eligibility?.length > 0 && (
                <div className="bg-primary/5 rounded-[2.5rem] p-12 space-y-8 border-l-8 border-primary">
                   <h3 className="text-3xl font-bold flex items-center gap-4">
                     <User className="h-8 w-8 text-primary" /> {t.eligibility}
                   </h3>
                   <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {research.eligibility.map((item: any, idx: number) => (
                       <li key={idx} className="flex gap-3 text-xl items-start">
                         <span className="text-primary font-bold">•</span>
                         {typeof item === 'string' ? item : item?.value || item?.text || item?.detail || item?.description || item?.name || ''}
                       </li>
                     ))}
                   </ul>
                </div>
                )}

                <div className="space-y-8">
                  <h3 className="text-3xl font-bold font-headline flex items-center gap-4">
                    <BookOpen className="h-8 w-8 text-primary" /> 
                    {['Scholarships', 'Research', 'STEM', 'Competitions'].includes(event.source) ? t.prepResources : t.extraInfo}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {research.resources?.map((res: any, idx: number) => {
                      const isVideo = res.type === 'Video' ||
                        (res.url && (res.url.includes('youtube.com') || res.url.includes('youtu.be')));
                      const ytId = isVideo
                        ? (res.url?.match(/[?&]v=([^&]+)/)?.[1] || res.url?.match(/youtu\.be\/([^?]+)/)?.[1])
                        : null;
                      return isVideo ? (
                        <a
                          key={idx}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group rounded-3xl overflow-hidden bg-background border-2 border-primary/10 hover:border-primary transition-all shadow-xl"
                        >
                          {ytId && (
                            <div className="relative w-full aspect-video overflow-hidden">
                              <img
                                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                alt={res.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                  <Video className="h-7 w-7 text-white ml-1" />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                              <Badge variant="outline" className="text-red-500 border-red-300">{res.type}</Badge>
                              <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <h4 className="text-base font-bold group-hover:text-primary transition-colors line-clamp-2">{res.title}</h4>
                            {res.channel && <p className="text-sm text-muted-foreground mt-1">{res.channel}</p>}
                          </div>
                        </a>
                      ) : (
                        <a
                          key={idx}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group p-6 rounded-3xl bg-background border-2 border-primary/10 hover:border-primary transition-all shadow-xl"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <Badge variant="outline">{res.type}</Badge>
                            <ExternalLink className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <h4 className="text-xl font-bold group-hover:text-primary transition-colors">{res.title}</h4>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-10">
            <div className="bg-background rounded-[2.5rem] border-2 border-primary/10 p-10 shadow-2xl space-y-10 sticky top-32 z-10">
               <h3 className="text-2xl font-black uppercase tracking-[0.2em] opacity-40">{t.quickDetails}</h3>
               
               <div className="space-y-8">
                 <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <MapPin className="h-8 w-8 text-primary" />
                   </div>
                   <div>
                     <p className="text-sm font-black uppercase opacity-40">{t.locationLabel}</p>
                     <p className="text-xl font-bold">{(event.location && !/\bnull\b|\bnone\b|\bundefined\b/i.test(event.location)) ? event.location : '—'}</p>
                   </div>
                 </div>

                 <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <Calendar className="h-8 w-8 text-primary" />
                   </div>
                   <div>
                     <p className="text-sm font-black uppercase opacity-40">{t.deadlineLabel}</p>
                     <p className="text-xl font-bold">
                       {event.deadline
                         ? `${new Date(event.deadline).getDate().toString().padStart(2, '0')}/${(new Date(event.deadline).getMonth() + 1).toString().padStart(2, '0')}/${new Date(event.deadline).getFullYear()}`
                         : t.rolling}
                     </p>
                   </div>
                 </div>

                 <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <User className="h-8 w-8 text-primary" />
                   </div>
                   <div>
                     <p className="text-sm font-black uppercase opacity-40">{t.ageGroup}</p>
                     <p className="text-xl font-bold">{event.age_min} – {event.age_max} {t.years}</p>
                   </div>
                 </div>

                 <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <Languages className="h-8 w-8 text-primary" />
                   </div>
                   <div>
                     <p className="text-sm font-black uppercase opacity-40">{t.languageLabel}</p>
                     <p className="text-xl font-bold">{(event.language && !/\bnull\b|\bnone\b|\bundefined\b/i.test(event.language)) ? translateLanguage(event.language, t) : '—'}</p>
                   </div>
                 </div>
               </div>

               {research?.officialWebsite && (
                 <a
                   href={research.officialWebsite}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="pt-6 border-t border-primary/10 flex items-center justify-center gap-6 hover:opacity-80 transition-opacity"
                 >
                   <Globe className="h-6 w-6 text-primary" />
                   <span className="font-bold text-sm uppercase tracking-widest text-primary">
                     {research.applyLabel || t.officialWebsite}
                   </span>
                 </a>
               )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
