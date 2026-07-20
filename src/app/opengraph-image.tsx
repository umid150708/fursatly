import { ImageResponse } from 'next/og';

/** Site-wide Open Graph card (homepage, /auth, /account link previews). */
export const alt = 'Fursatly — opportunities for Central Asian students';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          backgroundColor: 'hsl(222 22% 8%)',
          backgroundImage:
            'radial-gradient(circle at 20% 15%, hsl(174 62% 50% / 0.25), transparent 50%), radial-gradient(circle at 80% 85%, hsl(43 85% 60% / 0.22), transparent 50%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>Fursatly</div>
        <div style={{ display: 'flex', fontSize: 34, color: 'hsl(220 12% 72%)', maxWidth: 900, textAlign: 'center' }}>
          Scholarships, competitions and programs for Central Asian students — researched, translated, in one place.
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: 'hsl(174 62% 50%)', marginTop: 12 }}>fursatly.uz</div>
      </div>
    ),
    size,
  );
}
