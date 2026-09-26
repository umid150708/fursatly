'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wordmark } from '@/components/brand/Wordmark';
import type { Dict } from '@/lib/translations';

type LegalKey = 'about';

const LEGAL_CONTENT: Record<LegalKey, { title: string; body: string }> = {
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

**The name**
In Uzbek, "fursat" means opportunity or chance. "Fursatly" means being in the right place at the right time — which is exactly what we help you do.

**Get in touch**
hello@fursatly.uz`,
  },
};

export function SiteFooter({ t, onCategory }: { t: Dict; onCategory: (c: string | null) => void }) {
  const [legal, setLegal] = useState<LegalKey | null>(null);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="space-y-5 md:col-span-2">
            <div className="text-2xl">
              <Wordmark />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t.footerDesc}</p>
          </div>

          <nav className="space-y-4">
            <h4 className="text-eyebrow text-muted-foreground">{t.footerPlatform}</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: t.footerBrowse, cat: null },
                { label: t.catScholarships, cat: 'Scholarships' },
                { label: t.catCompetitions, cat: 'Competitions' },
                { label: t.catInternships, cat: 'Internships' },
                { label: t.catVolunteer, cat: 'Volunteer' },
              ].map(({ label, cat }) => (
                <li key={label}>
                  <button onClick={() => onCategory(cat)} className="text-muted-foreground transition-colors hover:text-accent">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="space-y-4">
            <h4 className="text-eyebrow text-muted-foreground">{t.footerLegal}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-accent">
                  {t.footerPrivacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground transition-colors hover:text-accent">
                  {t.footerTerms}
                </Link>
              </li>
              <li>
                <Link href="/privacy#cookies" className="text-muted-foreground transition-colors hover:text-accent">
                  {t.footerCookies}
                </Link>
              </li>
              <li>
                <button onClick={() => setLegal('about')} className="text-muted-foreground transition-colors hover:text-accent">
                  {t.footerAbout}
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Fursatly. {t.footerRights}</span>
          <button onClick={scrollTop} className="flex items-center gap-2 transition-colors hover:text-accent">
            {t.backToTop} <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={!!legal} onOpenChange={() => setLegal(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{legal && LEGAL_CONTENT[legal].title}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-line pt-2 text-sm leading-relaxed text-muted-foreground">
            {legal && LEGAL_CONTENT[legal].body.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**'))
                return <p key={i} className="mb-1 mt-4 font-semibold text-foreground">{line.replace(/\*\*/g, '')}</p>;
              if (line.startsWith('•')) return <p key={i} className="pl-3">{line}</p>;
              if (line === '') return <div key={i} className="h-2" />;
              return <p key={i}>{line}</p>;
            })}
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
