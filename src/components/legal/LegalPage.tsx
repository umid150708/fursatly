'use client';

import { useLanguage } from '@/context/LanguageContext';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { LEGAL_UPDATED, type LegalDocs } from '@/lib/legal/types';
import { formatDate } from '@/lib/dates';

/**
 * Renders one legal document in the visitor's current locale. English is the
 * SSR default (LanguageProvider starts on 'en'), which is also the legally
 * binding text — the Terms say so. Section ids double as anchors, so
 * /privacy#cookies lands on the cookie section in every language.
 */
export function LegalPage({ docs }: { docs: LegalDocs }) {
  const { t, locale } = useLanguage();
  const doc = docs[locale];

  return (
    <>
      <SiteNav />
      <main className="container py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[15rem_1px_minmax(0,46rem)] lg:gap-12">
          <nav aria-label={t.onThisPage} className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <p className="text-eyebrow border-b-2 border-foreground pb-2">{t.onThisPage}</p>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id} className="border-b border-border">
                  <a href={`#${s.id}`} className="block py-2.5 leading-snug transition-colors hover:text-accent">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <span aria-hidden className="hidden bg-foreground lg:block" />

          <article className="min-w-0">
            <p className="text-eyebrow text-muted-foreground">
              {t.legalUpdated} {formatDate(`${LEGAL_UPDATED}T12:00:00`, locale)}
            </p>
            <h1 className="text-hero mt-3">{doc.title}</h1>
            <p className="mt-6 text-xl italic leading-relaxed text-muted-foreground">{doc.intro}</p>

            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
                <h2 className="border-b-2 border-foreground pb-2 font-display text-2xl font-black tracking-[-0.02em] md:text-3xl">
                  {s.heading}
                </h2>
                <div className="mt-4 space-y-4 text-[1.05rem] leading-relaxed">
                  {s.body.map((p, i) =>
                    p.startsWith('• ') ? (
                      <p key={i} className="grid grid-cols-[1.25rem_1fr]">
                        <span aria-hidden className="mt-[0.6em] h-2 w-2 bg-foreground" />
                        <span>{p.slice(2)}</span>
                      </p>
                    ) : (
                      <p key={i}>{p}</p>
                    ),
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
