'use client';

import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wordmark } from '@/components/brand/Wordmark';
import type { Dict } from '@/lib/translations';

type LegalKey = 'privacy' | 'terms' | 'cookies' | 'about';

const LEGAL_CONTENT: Record<LegalKey, { title: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    body: `Last updated: May 2025

Fursatly ("we", "our", "us") respects your privacy. This policy explains what data we collect and how we use it.

**What we collect**
• Account information (email, name) when you sign in
• Usage data (pages visited, searches made) to improve recommendations
• Device information (browser type, language preference)

**How we use it**
• To show you relevant opportunities based on your age and interests
• To remember your language preference
• To send you deadline reminders (only if you opt in)

**What we don't do**
• We never sell your personal data to third parties
• We never share your data with event organizers without your consent
• We don't use your data for advertising

**Data storage**
All data is stored securely in Supabase (EU region). You can request deletion of your account and all associated data at any time by contacting us.

**Contact**
For privacy concerns: privacy@fursatly.uz`,
  },
  terms: {
    title: 'Terms of Use',
    body: `Last updated: May 2025

By using Fursatly, you agree to these terms.

**The platform**
Fursatly is a free platform that aggregates publicly available youth opportunities — scholarships, competitions, internships, and programs. We curate and translate this information to make it accessible to Uzbek youth.

**Your responsibilities**
• You must be at least 13 years old to use Fursatly
• You agree not to misuse the platform (spam, scraping, abuse)
• You understand that opportunity details come from third-party sources — always verify with the official website before applying

**Our responsibilities**
• We strive to keep information accurate and up to date
• We are not responsible for outcomes of applications made through opportunities listed here
• We do not guarantee admission, selection, or any result from any opportunity

**Intellectual property**
The Fursatly name, logo, and design are our property. Opportunity content belongs to the respective organizations.

**Changes**
We may update these terms. Continued use of the platform means you accept any updates.

**Contact**
legal@fursatly.uz`,
  },
  cookies: {
    title: 'Cookie Policy',
    body: `Last updated: May 2025

Fursatly uses a minimal set of cookies to make the site work properly.

**Essential cookies (always active)**
• Session token — keeps you logged in
• Language preference — remembers whether you chose Uzbek, Russian, or English
• Theme preference — remembers light/dark mode

**Analytics cookies (optional)**
• We may use anonymous analytics to understand how people use the site. No personal data is included.

**What we don't use**
• No advertising cookies
• No third-party tracking cookies
• No social media tracking pixels

**Managing cookies**
You can clear cookies any time through your browser settings. Clearing session cookies will log you out.

**Contact**
cookies@fursatly.uz`,
  },
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
              {([
                { label: t.footerPrivacy, key: 'privacy' },
                { label: t.footerTerms, key: 'terms' },
                { label: t.footerCookies, key: 'cookies' },
                { label: t.footerAbout, key: 'about' },
              ] as const).map(({ label, key }) => (
                <li key={key}>
                  <button onClick={() => setLegal(key)} className="text-muted-foreground transition-colors hover:text-accent">
                    {label}
                  </button>
                </li>
              ))}
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
