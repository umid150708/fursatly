'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { LEGAL_UPDATED, type LegalDocs } from '@/lib/legal/types';

/**
 * Renders one legal document in the visitor's current locale. English is the
 * SSR default (LanguageProvider starts on 'en'), which is also the legally
 * binding text — the Terms say so. Section ids double as anchors, so
 * /privacy#cookies lands on the cookie section in every language.
 */
export function LegalPage({ docs }: { docs: LegalDocs }) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const doc = docs[locale];

  return (
    <>
      <SiteNav />
      <main className="container max-w-3xl py-28 md:py-32">
        <p className="text-eyebrow mb-3 text-muted-foreground">
          {t.legalUpdated} {LEGAL_UPDATED}
        </p>
        <h1 className="mb-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">{doc.title}</h1>
        <p className="mb-12 text-base leading-relaxed text-muted-foreground">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="mb-10 scroll-mt-28">
            <h2 className="mb-3 font-display text-xl font-semibold">{s.heading}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {s.body.map((p, i) => (
                <p key={i} className={p.startsWith('• ') ? 'pl-4' : undefined}>
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter t={t} onCategory={() => router.push('/')} />
    </>
  );
}
