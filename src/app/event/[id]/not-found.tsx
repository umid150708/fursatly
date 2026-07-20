"use client";

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { SiteNav } from '@/components/home/SiteNav';

/** Rendered by notFound() when an event slug/UUID matches nothing — deleted
 *  after its deadline, or a mistyped link. Serves a real 404 status. */
export default function EventNotFound() {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = translations[locale];

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
