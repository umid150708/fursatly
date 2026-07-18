"use client";

import React, { useEffect, useState, useMemo, type CSSProperties, type ElementType } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDb } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { translations, translateSource, translateLanguage } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { SiteNav } from '@/components/home/SiteNav';
import { SaveButton } from '@/components/SaveButton';
import { MentorPanel } from '@/components/mentor/MentorPanel';
import { SiteFooter } from '@/components/home/SiteFooter';
import { Reveal } from '@/components/motion/Reveal';
import { catHue } from '@/lib/categoryColor';
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
  ExternalLink,
} from 'lucide-react';

/** Pull a display string from a research item that may be a string or an object. */
const itemText = (x: any): string =>
  typeof x === 'string'
    ? x
    : x?.value || x?.text || x?.detail || x?.description || x?.name || '';

/** URLs here come from scraped posts + LLM output stored in the DB — never trust
 *  them as-is in an href. Only protocols a student can follow are allowed;
 *  anything else (javascript:, data:, file:) renders no link at all. */
const safeHref = (url?: string | null): string | null => {
  const s = (url ?? '').trim();
  return /^(https?:|mailto:)/i.test(s) ? s : null;
};

/** Card wrapper for the list sections — matches the homepage's bordered surface,
 *  with the per-category hue inherited from the page root via the --hue var. */
function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <h3 className="mb-6 flex items-center gap-3 font-display text-lg font-semibold tracking-tight md:text-xl">
        <Icon className="h-5 w-5 shrink-0 text-[hsl(var(--hue))]" />
        {label}
      </h3>
      {children}
    </section>
  );
}

/** A labelled fact row in the sidebar quick-details card. */
function Fact({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
        <Icon className="h-5 w-5 text-[hsl(var(--hue))]" />
      </span>
      <div className="min-w-0">
        <p className="text-eyebrow text-muted-foreground">{label}</p>
        <p className="truncate font-display font-semibold">{value}</p>
      </div>
    </div>
  );
}

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteNav />
        <main className="container flex flex-1 flex-col items-center justify-center gap-6 pt-28 text-center">
          <h1 className="text-display font-display font-semibold">{t.eventNotFound}</h1>
          <Button onClick={() => router.push('/')}>{t.goHome}</Button>
        </main>
      </div>
    );
  }

  const hue = catHue(event.source);
  const title = event.research_data?.translations?.[locale]?.title || event.title;

  const daysLeft = event.deadline
    ? Math.ceil((new Date(event.deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const urgent = daysLeft != null && daysLeft >= 0 && daysLeft <= 7;

  const countdown =
    daysLeft == null || daysLeft < 0
      ? null
      : daysLeft === 0
      ? (t.deadlineToday || 'Closes today')
      : daysLeft === 1
      ? (t.deadline1Day || '1 day left')
      : `${daysLeft} ${t.daysLeft || 'days left'}`;

  const deadlineText = event.deadline
    ? `${String(new Date(event.deadline).getDate()).padStart(2, '0')}/${String(new Date(event.deadline).getMonth() + 1).padStart(2, '0')}/${new Date(event.deadline).getFullYear()}`
    : t.rolling;

  const cleanLocation = (event.location && !/\bnull\b|\bnone\b|\bundefined\b/i.test(event.location)) ? event.location : '—';
  const cleanLanguage = (event.language && !/\bnull\b|\bnone\b|\bundefined\b/i.test(event.language)) ? translateLanguage(event.language, t) : '—';
  const applyHref = safeHref(research?.officialWebsite);

  const resourcesLabel = ['Scholarships', 'Research', 'STEM', 'Competitions'].includes(event.source)
    ? t.prepResources
    : t.extraInfo;

  return (
    <div className="flex min-h-screen flex-col" style={{ ['--hue' as any]: hue } as CSSProperties}>
      <SiteNav />

      <main className="flex-1 pb-24 pt-28 md:pt-32">
        <div className="container">
          {/* Back link */}
          <button
            onClick={() => router.back()}
            className="mb-8 inline-flex items-center gap-2 text-eyebrow text-muted-foreground transition-colors hover:text-[hsl(var(--hue))]"
          >
            <ArrowLeft className="h-4 w-4" /> {t.backToOpportunities}
          </button>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-14">
            {/* ── Main column ─────────────────────────────────────────── */}
            <div className="space-y-10 md:space-y-12 lg:col-span-2">
              {/* Hero */}
              <Reveal>
                <header className="grain relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-9 md:p-12">
                  {/* Category-hue glow */}
                  <div
                    className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
                    style={{ background: `hsl(var(--hue) / 0.16)` }}
                    aria-hidden
                  />
                  <div className="relative">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-eyebrow font-semibold text-[hsl(var(--hue))]">
                        {translateSource(event.source || 'Other', t)}
                      </span>
                      {countdown && (
                        <span className={`inline-flex items-center gap-1.5 text-eyebrow font-semibold ${urgent ? 'text-urgent' : 'text-muted-foreground'}`}>
                          <Calendar className="h-3.5 w-3.5" /> {countdown}
                        </span>
                      )}
                    </div>

                    <h1 className="max-w-3xl font-display text-3xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-[3.5rem]">
                      {title}
                    </h1>

                    {event.research_data?.organisation && (
                      <p className="mt-5 text-base text-muted-foreground md:text-lg">
                        {t.organisedBy || 'Organised by'}{' '}
                        <span className="font-semibold text-foreground">{event.research_data.organisation}</span>
                      </p>
                    )}

                    <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-eyebrow text-muted-foreground">
                      {event.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[hsl(var(--hue))]" /> {event.location}
                        </span>
                      )}
                      {event.language && (
                        <span className="inline-flex items-center gap-1.5">
                          <Languages className="h-3.5 w-3.5 text-[hsl(var(--hue))]" /> {translateLanguage(event.language, t)}
                        </span>
                      )}
                      {(event.age_min || event.age_max) && (
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-[hsl(var(--hue))]" /> {event.age_min ?? '?'}–{event.age_max ?? '?'}
                        </span>
                      )}
                    </div>

                    <div className="mt-6">
                      <SaveButton eventId={event.id} size="lg" />
                    </div>
                  </div>
                </header>
              </Reveal>

              {/* Overview */}
              <Reveal>
                <section className="space-y-5">
                  <h2 className="text-eyebrow text-muted-foreground">{t.overview}</h2>
                  <p className="whitespace-pre-wrap text-lg leading-relaxed text-muted-foreground md:text-xl">
                    {research?.extendedDescription || event.description}
                  </p>
                </section>
              </Reveal>

              {research ? (
                <>
                  {research.keyDetails?.length > 0 && (
                    <Reveal>
                      <InfoCard icon={CheckCircle2} label={t.keyDetails}>
                        <ul className="space-y-4">
                          {research.keyDetails.map((detail: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-3 text-base leading-relaxed md:text-lg">
                              <span className="mt-1 font-bold text-[hsl(var(--hue))]">→</span>
                              {itemText(detail)}
                            </li>
                          ))}
                        </ul>
                      </InfoCard>
                    </Reveal>
                  )}

                  {research.benefits?.length > 0 && (
                    <Reveal>
                      <InfoCard icon={CheckCircle2} label={t.keyBenefits}>
                        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {research.benefits.map((benefit: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-3 text-base leading-relaxed md:text-lg">
                              <span className="mt-0.5 font-bold text-[hsl(var(--hue))]">•</span>
                              {itemText(benefit)}
                            </li>
                          ))}
                        </ul>
                      </InfoCard>
                    </Reveal>
                  )}

                  {research.eligibility?.length > 0 && (
                    <Reveal>
                      <InfoCard icon={User} label={t.eligibility}>
                        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {research.eligibility.map((item: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-3 text-base leading-relaxed md:text-lg">
                              <span className="mt-0.5 font-bold text-[hsl(var(--hue))]">•</span>
                              {itemText(item)}
                            </li>
                          ))}
                        </ul>
                      </InfoCard>
                    </Reveal>
                  )}

                  {research.resources?.length > 0 && (
                    <Reveal>
                      <section className="space-y-6">
                        <h3 className="flex items-center gap-3 font-display text-lg font-semibold tracking-tight md:text-xl">
                          <BookOpen className="h-5 w-5 text-[hsl(var(--hue))]" /> {resourcesLabel}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {research.resources.map((res: any, idx: number) => {
                            const href = safeHref(res.url);
                            if (!href) return null; // unlinkable resource — don't render a dead card
                            const isVideo = res.type === 'Video' ||
                              href.includes('youtube.com') || href.includes('youtu.be');
                            const ytId = isVideo
                              ? (href.match(/[?&]v=([^&]+)/)?.[1] || href.match(/youtu\.be\/([^?]+)/)?.[1])
                              : null;
                            return isVideo ? (
                              <a
                                key={idx}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group overflow-hidden rounded-xl border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-[hsl(var(--hue)/0.55)]"
                              >
                                {ytId && (
                                  <div className="relative aspect-video w-full overflow-hidden">
                                    <img
                                      src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                      alt={res.title}
                                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                                      <span className="grid h-14 w-14 place-items-center rounded-full bg-red-600 shadow-lg">
                                        <Video className="ml-0.5 h-6 w-6 text-white" />
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <div className="p-5">
                                  <div className="mb-2 flex items-start justify-between">
                                    <span className="text-eyebrow font-semibold text-red-500">{res.type}</span>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                  </div>
                                  <h4 className="line-clamp-2 font-display font-semibold leading-snug transition-colors group-hover:text-[hsl(var(--hue))]">
                                    {res.title}
                                  </h4>
                                  {res.channel && <p className="mt-1 text-sm text-muted-foreground">{res.channel}</p>}
                                </div>
                              </a>
                            ) : (
                              <a
                                key={idx}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[hsl(var(--hue)/0.55)]"
                              >
                                <div className="mb-4 flex items-start justify-between">
                                  <span className="text-eyebrow font-semibold text-muted-foreground">{res.type}</span>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                                <h4 className="font-display text-lg font-semibold leading-snug transition-colors group-hover:text-[hsl(var(--hue))]">
                                  {res.title}
                                </h4>
                              </a>
                            );
                          })}
                        </div>
                      </section>
                    </Reveal>
                  )}
                </>
              ) : null}
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside>
              <div className="sticky top-24 space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
                <h3 className="text-eyebrow text-muted-foreground">{t.quickDetails}</h3>

                <div className="space-y-5">
                  <Fact icon={MapPin} label={t.locationLabel} value={cleanLocation} />
                  <Fact icon={Calendar} label={t.deadlineLabel} value={deadlineText} />
                  <Fact icon={User} label={t.ageGroup} value={`${event.age_min} – ${event.age_max} ${t.years}`} />
                  <Fact icon={Languages} label={t.languageLabel} value={cleanLanguage} />
                </div>

                {applyHref && (
                  <a
                    href={applyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
                  >
                    <Globe className="h-4 w-4" />
                    {research.applyLabel || t.officialWebsite}
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter t={t} onCategory={() => router.push('/')} />
      <MentorPanel eventId={event.id} />
    </div>
  );
}
