import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseClientProvider, AuthProvider } from '@/supabase';
import { SavedProvider } from '@/context/SavedContext';
import { MotionConfigProvider } from '@/components/motion/MotionConfig';
import { SmoothScrollProvider } from '@/components/motion/SmoothScrollProvider';
import { SiteBackground } from '@/components/SiteBackground';
import { BackToTop } from '@/components/BackToTop';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-body',
  display: 'swap',
});

const display = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fursatly.uz'),
  title: 'Fursatly — Unlock Your Future',
  description: 'AI-curated scholarships, competitions, fellowships and programs for Central Asian students. Every opportunity, researched and translated.',
  icons: { icon: '/icon.png', apple: '/icon.png' },
  openGraph: {
    siteName: 'Fursatly',
    type: 'website',
    title: 'Fursatly — Unlock Your Future',
    description: 'AI-curated scholarships, competitions, fellowships and programs for Central Asian students.',
  },
};

/* Decide the motion tier BEFORE first paint, so scroll-reveal targets are only
   hidden on devices that will actually animate them (no FOUC).
   The lightweight motion (smooth-scroll, reveals, card rails) runs for everyone
   EXCEPT people who opted out via OS "Reduce Motion" or Data Saver — the heavy
   WebGL shader is gated separately (see MotionConfig). */
const motionProbe = `(function(){try{
  var m=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var save=navigator.connection&&navigator.connection.saveData;
  document.documentElement.dataset.motion=(!m&&!save)?'full':'reduced';
}catch(e){document.documentElement.dataset.motion='full';}})();`;

/* Apply the theme BEFORE first paint. Dark is the default for first-time
   visitors; a saved "light" preference wins. Mirrors resolveTheme() in
   src/lib/preferences.ts — keep the two in sync. */
const themeProbe = `(function(){try{
  var light=localStorage.getItem('fursatly_theme')==='light';
  if(!light)document.documentElement.classList.add('dark');
  /* Browser chrome on mobile, corrected before first paint. Hexes mirror
     --bg-dark / --bg-light in globals.css — keep the three in sync. */
  if(light){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#f7f6f3');}
}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${display.variable}`}>
      <head>
        {/* Dark is the first-visit default; the probe below rewrites this when a
            light preference is saved, and ThemeContext keeps it current after. */}
        <meta name="theme-color" content="#111318" />
        <script dangerouslySetInnerHTML={{ __html: themeProbe }} />
        <script dangerouslySetInnerHTML={{ __html: motionProbe }} />
      </head>
      <body className="font-body antialiased min-h-screen">
        <SiteBackground />
        <ThemeProvider>
          <SupabaseClientProvider>
            <AuthProvider>
              <SavedProvider>
                <LanguageProvider>
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
