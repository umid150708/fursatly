"use client";

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/translations';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';

/** Rendered by notFound() when an event slug/UUID matches nothing — deleted
 *  after its deadline, or a mistyped link. Serves a real 404 status. */
export default function EventNotFound() {
  const { locale } = useLanguage();
  const t = translations[locale];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="container flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
        <p className="text-eyebrow text-accent">404</p>
        <h1 className="text-display max-w-2xl">{t.eventNotFound}</h1>
        <Link
          href="/"
          className="font-label inline-flex h-12 items-center bg-foreground px-6 text-sm font-semibold uppercase tracking-[0.08em] text-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {t.goHome}
        </Link>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
