import type { Metadata } from 'next';
import { Literata, Fira_Sans_Condensed } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { PreferencesSync } from '@/context/PreferencesSync';
import { themeProbeScript } from '@/lib/preferences';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseClientProvider, AuthProvider } from '@/supabase';
import { SavedProvider } from '@/context/SavedContext';
import { MotionConfigProvider } from '@/components/motion/MotionConfig';
import { SmoothScrollProvider } from '@/components/motion/SmoothScrollProvider';
import { SiteBackground } from '@/components/SiteBackground';
import { BackToTop } from '@/components/BackToTop';
import { Analytics } from '@vercel/analytics/next';

/* `preload: false` on both faces is deliberate. next/font emits a
   <link rel="preload"> for EVERY subset, which defeats the whole point of the
   unicode-range split: an English visitor would download the latin-ext and
   cyrillic files at top priority, competing with the JS on the critical path,
   when only the latin one can ever be rendered. Without the preload the browser
   honours unicode-range and fetches only the subsets the page actually paints;
   `display: swap` gets text on screen sooner, and next/font's size-adjusted
   fallback keeps the swap from shifting layout.

   Gazette type: Literata (a newspaper serif) for headlines and reading text,
   Fira Sans Condensed for the small-caps labels, datelines and buttons. Both
   carry Cyrillic and the Uzbek Latin apostrophes. Literata's optical-size axis
   is left out on purpose — it roughly doubles the file for a subtle change. */
const serif = Literata({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  preload: false,
});

const label = Fira_Sans_Condensed({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-label',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fursatly.uz'),
  title: 'Fursatly — Unlock Your Future',
  description: 'AI-curated scholarships, competitions, fellowships and programs from around the world. Every opportunity, researched and translated.',
  icons: { icon: '/icon.png', apple: '/icon.png' },
  // Search Console ownership of https://fursatly.uz/, held by the
  // fursatly-seo service account (GCP project fursatly-search). Google
  // re-checks it, so removing this tag unverifies the site.
  verification: { google: 'hW_ZGLfT7M4aMp9s5LRQxgQbZkI3HVKCVQ9_CLFUgxw' },
  openGraph: {
    siteName: 'Fursatly',
    type: 'website',
    title: 'Fursatly — Unlock Your Future',
    description: 'AI-curated scholarships, competitions, fellowships and programs from around the world.',
  },
};

/* Apply the theme BEFORE first paint. English + light is what every visitor
   opens with; only a signed-in account's saved choice, or one made earlier in
   this tab, turns it dark. The script comes from src/lib/preferences.ts, next to
   the rule it mirrors. */
const themeProbe = themeProbeScript();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${serif.variable} ${label.variable}`}>
      <head>
        {/* Light is the default; the probe below rewrites this when the visitor
            should see dark, and ThemeContext keeps it current after. */}
        <meta name="theme-color" content="#f3efe6" />
        <script dangerouslySetInnerHTML={{ __html: themeProbe }} />
      </head>
      <body className="font-body antialiased min-h-screen">
        <SiteBackground />
        <ThemeProvider>
          <SupabaseClientProvider>
            <AuthProvider>
              <SavedProvider>
                <LanguageProvider>
                  <PreferencesSync />
                  <MotionConfigProvider>
                    <SmoothScrollProvider>
                      {children}
                      <BackToTop />
                      <Toaster />
                      <Analytics />
                    </SmoothScrollProvider>
                  </MotionConfigProvider>
                </LanguageProvider>
              </SavedProvider>
            </AuthProvider>
          </SupabaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
