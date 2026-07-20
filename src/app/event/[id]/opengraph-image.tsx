import { ImageResponse } from 'next/og';
import { fetchEventByParam } from '@/lib/event-server';
import { metaDescription } from '@/lib/event-meta';
import { canonicalSource, type CanonicalSource } from '@/lib/canonicalCategory';

/**
 * Per-event Open Graph card — what Telegram/Twitter/WhatsApp render when a
 * clean /event/<slug> link is shared. Satori can't read CSS variables, so the
 * category jewel tones are inlined here (dark-theme values from globals.css).
 */
export const revalidate = 300;
export const alt = 'Fursatly opportunity';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CATEGORY_COLOR: Record<CanonicalSource, string> = {
  Scholarships: 'hsl(43 85% 60%)',
  Competitions: 'hsl(354 75% 62%)',
  'Summer Programs': 'hsl(174 62% 50%)',
  Research: 'hsl(226 72% 68%)',
  Volunteer: 'hsl(152 55% 52%)',
  STEM: 'hsl(262 70% 68%)',
  Internships: 'hsl(20 80% 60%)',
  Workshops: 'hsl(200 75% 58%)',
  Other: 'hsl(220 12% 62%)',
};

const formatDeadline = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await fetchEventByParam(id);

  const title = (event?.title ?? 'Student opportunities').slice(0, 120);
  const category = canonicalSource(event?.source);
  const accent = CATEGORY_COLOR[category];
  const deadline = formatDeadline(event?.deadline);
  const description = event ? metaDescription(event).slice(0, 140) : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          backgroundColor: 'hsl(222 22% 8%)',
          backgroundImage: `radial-gradient(circle at 85% 10%, ${accent.replace(')', ' / 0.28)')}, transparent 55%)`,
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {category}
          </div>
          {deadline && (
            <div style={{ display: 'flex', fontSize: 26, color: 'hsl(220 12% 70%)' }}>
              Deadline {deadline}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 70 ? 52 : 64,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {description && (
            <div style={{ display: 'flex', fontSize: 28, lineHeight: 1.4, color: 'hsl(220 12% 70%)', maxWidth: 980 }}>
              {description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, backgroundColor: accent }} />
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 700 }}>Fursatly</div>
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: 'hsl(220 12% 70%)' }}>fursatly.uz</div>
        </div>
      </div>
    ),
    size,
  );
}
