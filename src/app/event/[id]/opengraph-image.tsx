import { ImageResponse } from 'next/og';
import { fetchEventByParam } from '@/lib/event-server';
import { metaDescription } from '@/lib/event-meta';
import { canonicalSource, type CanonicalSource } from '@/lib/canonicalCategory';
import { formatDate } from '@/lib/dates';
import { gazetteFonts, OG } from '@/lib/og-fonts';

/**
 * Per-event Open Graph card — what Telegram/Twitter/WhatsApp render when a
 * clean /event/<slug> link is shared: a Gazette story on newsprint. Satori
 * can't read CSS variables, so the section inks are inlined here (the light
 * theme values from globals.css).
 */
export const revalidate = 300;
export const alt = 'Fursatly opportunity';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SECTION_INK: Record<CanonicalSource, string> = {
  Scholarships: 'hsl(212 60% 32%)',
  Competitions: 'hsl(8 68% 36%)',
  'Summer Programs': 'hsl(26 80% 30%)',
  Research: 'hsl(262 38% 42%)',
  Volunteer: 'hsl(150 48% 25%)',
  STEM: 'hsl(192 72% 25%)',
  Internships: 'hsl(30 12% 33%)',
  Workshops: 'hsl(334 58% 36%)',
  Other: 'hsl(30 6% 36%)',
};

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await fetchEventByParam(id);

  const title = (event?.title ?? 'Student opportunities').slice(0, 120);
  const category = canonicalSource(event?.source);
  const ink = SECTION_INK[category];
  const deadline = event?.deadline && !Number.isNaN(Date.parse(event.deadline))
    ? `Deadline ${formatDate(event.deadline, 'en')}`
    : null;
  const full = event ? metaDescription(event) : '';
  // End on a whole word with an ellipsis rather than mid-phrase.
  const description = full.length > 140 ? `${full.slice(0, 140).replace(/\s+\S*$/, '')}…` : full;
  const funded = event?.research_data?.funding_type === 'Full' ? 'Fully funded' : null;
  const kicker = [category, funded, event?.location].filter(Boolean).join(' · ').slice(0, 70);

  const fonts = await gazetteFonts({
    headline: `${title}Fursatly.`,
    body: description,
    label: `${kicker}${deadline ?? ''}fursatly.uz`.toUpperCase(),
  });
  const label = { fontFamily: 'Fira Sans Condensed', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' as const };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 64px',
          backgroundColor: OG.paper,
          color: OG.ink,
          fontFamily: 'Literata',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 14, borderBottom: `5px solid ${OG.ink}`, fontSize: 24, ...label }}>
          <span style={{ color: ink }}>{kicker}</span>
          {deadline && <span style={{ color: OG.vermilion }}>{deadline}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 70 ? 58 : 76,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: 1060,
            }}
          >
            {title}
          </div>
          {description && (
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 400, lineHeight: 1.4, color: OG.caption, maxWidth: 1000 }}>
              {description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: `2px solid ${OG.ink}` }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 900, letterSpacing: -1.5 }}>
            Fursatly<span style={{ color: OG.vermilion }}>.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: OG.caption, ...label }}>fursatly.uz</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
