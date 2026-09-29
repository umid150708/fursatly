'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wordmark } from '@/components/brand/Wordmark';
import { sectionHref } from '@/components/home/sections';
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

interface SiteFooterProps {
  t: Dict;
  /** Home page only: pick a section in place. Elsewhere the links go home. */
  onCategory?: (c: string | null) => void;
}

/** The colophon: nameplate, sections, legal pages, and the About note. */
export function SiteFooter({ t, onCategory }: SiteFooterProps) {
  const [legal, setLegal] = useState<LegalKey | null>(null);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const linkCls = 'text-left transition-colors hover:text-accent';
  const platform = [
    { label: t.footerBrowse, cat: null },
    { label: t.catScholarships, cat: 'Scholarships' },
    { label: t.catCompetitions, cat: 'Competitions' },
    { label: t.catInternships, cat: 'Internships' },
    { label: t.catVolunteer, cat: 'Volunteer' },
  ];

  return (
    <footer className="container mt-24">
      <div className="rule-heavy grid grid-cols-1 gap-10 pb-10 pt-8 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="text-4xl md:text-5xl">
            <Wordmark />
          </div>
          <p className="max-w-sm italic leading-relaxed text-muted-foreground">{t.footerDesc}</p>
        </div>

        <nav className="space-y-4">
          <h4 className="text-eyebrow">{t.footerPlatform}</h4>
          <ul className="font-label space-y-2.5 text-[0.95rem]">
            {platform.map(({ label, cat }) => (
              <li key={label}>
                {onCategory ? (
                  <button type="button" onClick={() => onCategory(cat)} className={linkCls}>{label}</button>
                ) : (
                  <a href={sectionHref(cat)} className={linkCls}>{label}</a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <nav className="space-y-4">
          <h4 className="text-eyebrow">{t.footerLegal}</h4>
          <ul className="font-label space-y-2.5 text-[0.95rem]">
            <li><Link href="/privacy" className={linkCls}>{t.footerPrivacy}</Link></li>
            <li><Link href="/terms" className={linkCls}>{t.footerTerms}</Link></li>
            <li><Link href="/privacy#cookies" className={linkCls}>{t.footerCookies}</Link></li>
            <li>
              <button type="button" onClick={() => setLegal('about')} className={linkCls}>{t.footerAbout}</button>
            </li>
          </ul>
        </nav>
      </div>

      <div className="text-eyebrow flex flex-col items-center justify-between gap-3 border-t border-foreground py-5 text-[0.75rem] text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Fursatly · {t.footerRights}</span>
        <button type="button" onClick={scrollTop} className="flex min-h-11 items-center gap-2 uppercase tracking-[0.1em] transition-colors hover:text-accent">
          {t.backToTop} <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={!!legal} onOpenChange={() => setLegal(null)}>
        <DialogContent data-lenis-prevent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-black">{legal && LEGAL_CONTENT[legal].title}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-line pt-2 leading-relaxed text-muted-foreground">
            {legal && LEGAL_CONTENT[legal].body.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**'))
                return <p key={i} className="text-eyebrow mb-1 mt-4 text-foreground">{line.replace(/\*\*/g, '')}</p>;
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
