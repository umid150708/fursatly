import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseClientProvider } from '@/supabase';
import { MotionConfigProvider } from '@/components/motion/MotionConfig';
import { SmoothScrollProvider } from '@/components/motion/SmoothScrollProvider';

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
  title: 'Fursatly — Unlock Your Future',
  description: 'AI-curated scholarships, competitions, fellowships and programs for Central Asian students. Every opportunity, researched and translated.',
  icons: { icon: '/icon.png', apple: '/icon.png' },
};

/* Decide the motion tier BEFORE first paint, so scroll-reveal targets are only
   hidden on devices that will actually animate them (no FOUC on weak phones). */
const motionProbe = `(function(){try{
  var m=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mem=navigator.deviceMemory||4, cores=navigator.hardwareConcurrency||4;
  var save=navigator.connection&&navigator.connection.saveData;
  document.documentElement.dataset.motion=(!m&&mem>=4&&cores>=4&&!save)?'full':'reduced';
}catch(e){document.documentElement.dataset.motion='reduced';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" suppressHydrationWarning className={`${inter.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionProbe }} />
      </head>
      <body className="font-body antialiased min-h-screen">
        <ThemeProvider>
          <SupabaseClientProvider>
            <LanguageProvider>
              <MotionConfigProvider>
                <SmoothScrollProvider>
                  {children}
                  <Toaster />
                </SmoothScrollProvider>
              </MotionConfigProvider>
            </LanguageProvider>
          </SupabaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
