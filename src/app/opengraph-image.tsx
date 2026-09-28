import { ImageResponse } from 'next/og';
import { gazetteFonts, OG } from '@/lib/og-fonts';

/** Site-wide Open Graph card (homepage, /auth, /account link previews):
 *  the Gazette masthead on newsprint. */
export const alt = 'Fursatly — opportunities for Central Asian students';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TAGLINE = 'Scholarships, competitions and programs — found, researched and translated every morning';
const STRIP = 'For the students of Central Asia';

export default async function OgImage() {
  const fonts = await gazetteFonts({
    headline: 'Fursatly.',
    body: TAGLINE,
    label: `${STRIP} fursatly.uz · EN UZ RU`.toUpperCase(),
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
          padding: '48px 64px',
          backgroundColor: OG.paper,
          color: OG.ink,
          fontFamily: 'Literata',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 14, borderBottom: `2px solid ${OG.ink}`, fontSize: 22, ...label }}>
          <span>{STRIP}</span>
          <span>EN · UZ · RU</span>
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
          <div style={{ display: 'flex', fontSize: 200, fontWeight: 900, letterSpacing: -9, lineHeight: 1 }}>
            Fursatly<span style={{ color: OG.vermilion }}>.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 400, color: OG.caption, maxWidth: 920, textAlign: 'center', lineHeight: 1.35 }}>
            {TAGLINE}
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: `5px solid ${OG.ink}`, paddingTop: 4 }}>
          <div style={{ display: 'flex', flex: 1, borderTop: `2px solid ${OG.ink}`, paddingTop: 14, justifyContent: 'center', fontSize: 24, color: OG.vermilion, ...label }}>
            fursatly.uz
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
