"use client";

import React, { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDb } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { translations, translateSource, translateLanguage } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { SiteNav } from '@/components/home/SiteNav';
import { SaveButton } from '@/components/SaveButton';
import { MentorPanel, OPEN_MENTOR_EVENT } from '@/components/mentor/MentorPanel';
import { TelegramRemindHint } from '@/components/TelegramRemindHint';
import { LEGAL_EMAIL } from '@/lib/legal/types';
import { isUuid } from '@/lib/event-path';
import { formatDate, formatAges, daysUntil, daysLeftLabel } from '@/lib/dates';
import { SiteFooter } from '@/components/home/SiteFooter';
import { catHue } from '@/lib/categoryColor';
import { ArrowLeft, ArrowUpRight, Loader2, MessageCircle, Play } from 'lucide-react';

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

/** Map raw research_data from the DB row into the shape the page renders. */
function mapResearch(researchData: any) {
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

  return {
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
}

/** A section of the article: a heavy rule, a serif heading, then the body. */
function ArticleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="border-b-2 border-foreground pb-2 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One row of the "Quick details" box: label left, value right, dotted rule. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dotted border-muted-foreground py-3">
      <dt className="font-label text-[0.95rem] text-muted-foreground">{label}</dt>
      <dd className="text-right text-lg font-bold leading-snug">{value}</dd>
    </div>
  );
}

/**
 * Client half of the event page. The server component passes the full event
 * row (`initialEvent`) so the HTML ships rendered — the client fetch below
 * only runs as a fallback when the server-side fetch failed transiently.
 */
export default function EventClient({ initialEvent }: { initialEvent: any | null }) {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useDb();
  const { locale } = useLanguage();
  const t = translations[locale];

  const [event, setEvent] = useState<any>(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);

  // Merge locale-specific translations over raw English research data
  // Filter out empty/garbage items from a list
  const cleanList = (items: any[]): any[] => {
    if (!items) return [];
    return items.filter(item => {
      const s = (typeof item === 'string' ? item : item?.text || item?.name || item?.detail || item?.description || '').trim();
      return s.length >= 5;
    });
  };

  const rawResearch = useMemo(
    () => (event?.research_data ? mapResearch(event.research_data) : null),
    [event],
  );

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
    // Server already delivered the event — nothing to fetch.
    if (initialEvent) return;

    async function fetchEvent() {
      if (!supabase || !id) return;

      // The route param is either a clean slug or a legacy UUID — resolve both.
      const param = String(id);
      const query = supabase.from('events').select('*');
      const { data } = await (
        isUuid(param) ? query.eq('id', param) : query.eq('research_data->>slug', param)
      ).single();

      if (data) {
        // Landed via a legacy UUID but the event has a slug → upgrade the
        // address bar to the clean URL (no reload, no history entry).
        const slug = data.research_data?.slug;
        if (isUuid(param) && slug) {
          window.history.replaceState(null, '', `/event/${slug}`);
        }
        setEvent(data);
      }
      setLoading(false);
    }
    fetchEvent();
  }, [supabase, id, initialEvent]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteNav />
        <main className="container flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
          <p className="text-eyebrow text-accent">404</p>
          <h1 className="text-display">{t.eventNotFound}</h1>
          <Button onClick={() => router.push('/')}>{t.goHome}</Button>
        </main>
      </div>
    );
  }

  const hue = catHue(event.source);
  const title = event.research_data?.translations?.[locale]?.title || event.title;

  const daysLeft = daysUntil(event.deadline, Date.now());
  const urgent = daysLeft != null && daysLeft >= 0 && daysLeft <= 7;
  const passed = daysLeft != null && daysLeft < 0;

  const deadlineText = event.deadline ? formatDate(event.deadline, locale) : t.rolling;

  const cleanLocation = (event.location && !/\bnull\b|\bnone\b|\bundefined\b/i.test(event.location)) ? event.location : '—';
  const cleanLanguage = (event.language && !/\bnull\b|\bnone\b|\bundefined\b/i.test(event.language)) ? translateLanguage(event.language, t) : '—';
  const applyHref = safeHref(research?.officialWebsite);

  const resourcesLabel = ['Scholarships', 'Research', 'STEM', 'Competitions'].includes(event.source)
    ? t.prepResources
    : t.extraInfo;

  const funded = event.research_data?.funding_type === 'Full';
  const ages = formatAges(event.age_min, event.age_max, t.years, t.anyAge);

  const listText = 'text-[1.05rem] leading-relaxed md:text-lg';

  return (
    <div className="flex min-h-screen flex-col" style={{ ['--hue' as any]: hue } as CSSProperties}>
      <SiteNav />

      <main className="container flex-1 pb-8 pt-6 md:pt-8">
        <button
          onClick={() => router.back()}
          className="text-eyebrow inline-flex min-h-11 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t.backToOpportunities}
        </button>

        <div className="mt-4 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_1px_21rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_1px_23rem]">
          {/* ── The article ─────────────────────────────────────────── */}
          <article className="min-w-0">
            <p className="text-eyebrow text-[hsl(var(--hue))]">
              {[translateSource(event.source || 'Other', t), funded ? t.fullyFunded : null, cleanLocation !== '—' ? cleanLocation : null]
                .filter(Boolean)
                .join(' · ')}
            </p>

            <h1 className="mt-3 max-w-4xl font-display text-[2.6rem] font-black leading-[0.98] tracking-[-0.035em] md:text-6xl xl:text-7xl">
              {title}
            </h1>

            {event.research_data?.organisation && (
              <p className="mt-5 text-lg italic text-muted-foreground md:text-xl">
                {t.organisedBy || 'Organised by'}{' '}
                <span className="font-semibold not-italic text-foreground">{event.research_data.organisation}</span>
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-foreground py-3">
              <p className="font-label text-[0.95rem] text-muted-foreground">
                {[cleanLocation !== '—' ? cleanLocation : null, cleanLanguage !== '—' ? cleanLanguage : null, ages, `${t.deadlineLabel}: ${deadlineText}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <SaveButton eventId={event.id} size="lg" />
            </div>
            <TelegramRemindHint eventId={event.id} />

            {/* Phones: the countdown and the apply link up front, not under the article */}
            <div className="mt-5 flex items-stretch gap-3 lg:hidden">
              <span className="halftone flex shrink-0 items-center border border-foreground px-2">
                <span className="flex items-baseline gap-1.5 bg-background px-2 py-1">
                  {daysLeft != null && daysLeft > 1 ? (
                    <>
                      <span className={`font-display text-3xl font-black leading-none ${urgent ? 'text-urgent' : ''}`}>{daysLeft}</span>
                      <span className="text-eyebrow text-[0.65rem] leading-tight">{t.daysLeft}</span>
                    </>
                  ) : (
                    <span className={`text-eyebrow ${urgent ? 'text-urgent' : ''}`}>
                      {daysLeft == null ? t.rolling : passed ? deadlineText : daysLeftLabel(daysLeft, t)}
                    </span>
                  )}
                </span>
              </span>
              {applyHref && (
                <a
                  href={applyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-label flex min-h-12 flex-1 items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold uppercase tracking-[0.08em] text-background"
                >
                  {research?.applyLabel || t.officialWebsite} <ArrowUpRight className="h-4 w-4 shrink-0" />
                </a>
              )}
            </div>

            {/* Overview */}
            <section className="mt-8">
              <h2 className="sr-only">{t.overview}</h2>
              <p className="dropcap max-w-[65ch] whitespace-pre-wrap text-lg leading-relaxed md:text-[1.2rem]">
                {research?.extendedDescription || event.description}
              </p>
            </section>

            {research ? (
              <>
                {research.keyDetails?.length > 0 && (
                  <ArticleSection title={t.keyDetails}>
                    <ol>
                      {research.keyDetails.map((detail: any, idx: number) => (
                        <li key={idx} className={`grid grid-cols-[2.75rem_1fr] gap-3 border-b border-border py-4 ${listText}`}>
                          <span className="font-display text-3xl font-black leading-none text-[hsl(var(--hue))]">{idx + 1}</span>
                          <span>{itemText(detail)}</span>
                        </li>
                      ))}
                    </ol>
                  </ArticleSection>
                )}

                {(research.benefits?.length > 0 || research.eligibility?.length > 0) && (
                  <section className="rule-heavy mt-14 grid gap-10 pt-5 md:grid-cols-2 md:gap-12">
                    {research.benefits?.length > 0 && (
                      <div>
                        <h2 className="text-eyebrow text-[0.9rem]">{t.keyBenefits}</h2>
                        <ul className="mt-4 space-y-4">
                          {research.benefits.map((benefit: any, idx: number) => (
                            <li key={idx} className={`italic ${listText}`}>“{itemText(benefit)}”</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {research.eligibility?.length > 0 && (
                      <div>
                        <h2 className="text-eyebrow text-[0.9rem]">{t.eligibility}</h2>
                        <ul className="mt-4 space-y-3">
                          {research.eligibility.map((item: any, idx: number) => (
                            <li key={idx} className={`grid grid-cols-[1.5rem_1fr] gap-2 ${listText}`}>
                              <span aria-hidden className="mt-[0.4em] h-3.5 w-3.5 border-[1.5px] border-foreground" />
                              <span>{itemText(item)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}

                {research.resources?.length > 0 && (
                  <ArticleSection title={resourcesLabel}>
                    <ul>
                      {research.resources.map((res: any, idx: number) => {
                        const href = safeHref(res.url);
                        if (!href) return null; // unlinkable resource — don't render a dead link
                        const isVideo = res.type === 'Video' ||
                          href.includes('youtube.com') || href.includes('youtu.be');
                        const ytId = isVideo
                          ? (href.match(/[?&]v=([^&]+)/)?.[1] || href.match(/youtu\.be\/([^?]+)/)?.[1])
                          : null;
                        return (
                          <li key={idx} className="border-b border-border">
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group grid grid-cols-[7.5rem_1fr] items-center gap-4 py-4 sm:grid-cols-[10rem_1fr] sm:gap-5"
                            >
                              <span className="relative block aspect-video overflow-hidden border border-foreground">
                                {ytId ? (
                                  // Press-photo treatment: greyscale until hovered.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover grayscale transition duration-500 group-hover:grayscale-0"
                                  />
                                ) : (
                                  <span className="halftone block h-full w-full" />
                                )}
                                <span className="absolute inset-0 grid place-items-center">
                                  <span className="grid h-9 w-9 place-items-center bg-foreground text-background">
                                    {isVideo ? <Play className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                  </span>
                                </span>
                              </span>
                              <span className="min-w-0">
                                <span className="text-eyebrow block text-[0.7rem] text-muted-foreground">
                                  {res.type}{res.channel ? ` · ${res.channel}` : ''}
                                </span>
                                <span className="mt-1 line-clamp-3 block font-display text-lg font-bold leading-snug decoration-1 underline-offset-4 group-hover:underline md:text-xl">
                                  {res.title}
                                </span>
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </ArticleSection>
                )}
              </>
            ) : null}
          </article>

          <span aria-hidden className="hidden bg-foreground lg:block" />

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside>
            <div className="space-y-8 lg:sticky lg:top-24">
              <div className="halftone flex h-44 items-center justify-center border border-foreground">
                <span className="flex items-center gap-3 bg-background px-4 py-2.5">
                  {daysLeft != null && daysLeft > 1 ? (
                    <>
                      <span className={`font-display text-7xl font-black leading-none tracking-[-0.05em] ${urgent ? 'text-urgent' : ''}`}>
                        {daysLeft}
                      </span>
                      <span className="text-eyebrow max-w-[6rem] leading-tight">{t.daysLeft}</span>
                    </>
                  ) : (
                    <span className={`text-eyebrow text-xl ${urgent ? 'text-urgent' : ''}`}>
                      {daysLeft == null ? t.rolling : passed ? deadlineText : daysLeftLabel(daysLeft, t)}
                    </span>
                  )}
                </span>
              </div>

              <div className="rule-heavy pt-3">
                <h2 className="text-eyebrow">{t.quickDetails}</h2>
                <dl className="mt-2">
                  <Fact label={t.locationLabel} value={cleanLocation} />
                  <Fact label={t.deadlineLabel} value={deadlineText} />
                  <Fact label={t.ageGroup} value={ages} />
                  <Fact label={t.languageLabel} value={cleanLanguage} />
                  {event.research_data?.funding_type && (
                    <Fact label={t.fundingCoverage} value={funded ? t.fullyFunded : t.partial} />
                  )}
                </dl>
                {applyHref && (
                  <a
                    href={applyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-label mt-6 flex h-14 w-full items-center justify-center gap-2 bg-foreground px-6 text-base font-semibold uppercase tracking-[0.08em] text-background transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {research?.applyLabel || t.officialWebsite} <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_MENTOR_EVENT))}
                  className="font-label mt-3 hidden h-14 w-full items-center justify-center gap-2 border border-foreground px-6 text-base font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-foreground hover:text-background lg:flex"
                >
                  <MessageCircle className="h-4 w-4" /> {t.mentorTitle}
                </button>
                <p className="mt-4 text-sm italic leading-relaxed text-muted-foreground">
                  {t.eventSourceNotice}{' '}
                  <a
                    href={`mailto:${LEGAL_EMAIL}?subject=${encodeURIComponent(`Fursatly: ${event.title}`)}`}
                    className="not-italic underline underline-offset-2 hover:text-foreground"
                  >
                    {t.eventReportLink}
                  </a>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter t={t} />
      <MentorPanel eventId={event.id} />
    </div>
  );
}
