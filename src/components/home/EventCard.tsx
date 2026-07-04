'use client';

import { ArrowUpRight, MapPin, CalendarDays } from 'lucide-react';
import { translateSource, translateLanguage, type Locale, type Dict } from '@/lib/translations';

interface EventCardProps {
  event: any;
  t: Dict;
  locale: Locale;
  now: Date | null;
  onOpen: () => void;
}

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

/** Editorial opportunity card — monochrome, teal accent on hover, restrained radius. */
export function EventCard({ event, t, locale, now, onOpen }: EventCardProps) {
  const funding: string | null = event.research_data?.funding_type ?? null;
  const title =
    (locale !== 'en' && event.research_data?.translations?.[locale]?.title) || event.title;
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const daysLeft =
    deadline && now ? Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000) : null;
  const urgent = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

  return (
    <button
      onClick={onOpen}
      className="group flex h-full w-full flex-col rounded-xl border border-border bg-card p-6 text-left transition-all duration-500 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)] md:p-7"
    >
      <div className="mb-6 flex items-center justify-between">
        <span className="text-eyebrow text-muted-foreground">
          {translateSource(event.source || 'Other', t)}
        </span>
        {urgent ? (
          <span className="text-eyebrow font-semibold text-urgent">
            {daysLeft}{t.dLeft}
          </span>
        ) : funding ? (
          <span className="text-eyebrow font-semibold text-accent">
            {funding === 'Full' ? t.fullyFunded : t.partial}
          </span>
        ) : null}
      </div>

      <h3 className="mb-6 line-clamp-3 font-display text-xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-accent md:text-[1.6rem]">
        {title}
      </h3>

      <div className="mt-auto space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate">{event.location || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span>{deadline ? fmt(deadline) : t.rolling}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <span className="text-eyebrow text-muted-foreground">
          {translateLanguage(event.language, t)}
        </span>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </button>
  );
}
