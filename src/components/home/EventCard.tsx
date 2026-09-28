'use client';

import type { CSSProperties, KeyboardEvent } from 'react';
import { translateSource, translateLanguage, type Locale, type Dict } from '@/lib/translations';
import { SaveButton } from '@/components/SaveButton';
import { formatDate, daysUntil, daysLeftLabel } from '@/lib/dates';

interface EventCardProps {
  event: any;
  t: Dict;
  locale: Locale;
  now: Date | null;
  onOpen: () => void;
  /** Section ink as a CSS colour reference (e.g. "var(--cat-stem)"). */
  hue?: string;
  /** Inside a section the section name is already the heading, so the kicker
   *  carries the location instead. */
  kicker?: 'category' | 'location';
}

/**
 * One story in a section: a heavy rule on top, the section kicker in its ink,
 * a serif headline, an italic dateline and a footer carrying the deadline and
 * either the days left (closing soon) or the funding. No box — on newsprint a
 * story is held together by its rules.
 */
export function EventCard({ event, t, locale, now, onOpen, hue, kicker = 'category' }: EventCardProps) {
  const funding: string | null = event.research_data?.funding_type ?? null;
  const title =
    (locale !== 'en' && event.research_data?.translations?.[locale]?.title) || event.title;
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const daysLeft = now ? daysUntil(event.deadline, now.getTime()) : null;
  const urgent = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

  // Root is a div-as-link (not <button>) so the SaveButton inside stays
  // valid HTML — nested buttons break hydration and accessibility.
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  const tag = urgent
    ? { text: daysLeftLabel(daysLeft, t), cls: 'text-urgent' }
    : funding === 'Full'
    ? { text: t.fullyFunded, cls: 'text-gold' }
    : funding
    ? { text: t.partial, cls: 'text-muted-foreground' }
    : null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
      style={{ ['--hue' as any]: hue ?? 'var(--accent)' } as CSSProperties}
      className="group flex h-full w-full cursor-pointer flex-col border-t-2 border-foreground pt-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-eyebrow pt-1.5 text-[0.75rem] text-[hsl(var(--hue))]">
          {kicker === 'location' && event.location ? event.location : translateSource(event.source || 'Other', t)}
        </span>
        <SaveButton eventId={event.id} />
      </div>

      <h3 className="mt-1 line-clamp-4 font-display text-[1.35rem] font-extrabold leading-[1.15] tracking-tight decoration-1 underline-offset-4 group-hover:underline md:text-[1.5rem]">
        {title}
      </h3>

      <p className="mt-2 line-clamp-1 text-[0.95rem] italic text-muted-foreground">
        {[kicker === 'location' ? null : event.location, translateLanguage(event.language, t)].filter(Boolean).join(' · ') || '—'}
      </p>

      <div className="font-label mt-auto flex items-center justify-between gap-3 border-t border-border pt-2.5 text-sm">
        <span>{deadline ? formatDate(deadline, locale) : t.rolling}</span>
        {tag && <span className={`font-semibold uppercase tracking-[0.06em] ${tag.cls}`}>{tag.text}</span>}
      </div>
    </div>
  );
}
