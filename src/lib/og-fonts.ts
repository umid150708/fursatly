/**
 * Fonts for the Open Graph cards. Satori (next/og) cannot use next/font, so the
 * Gazette faces are fetched from Google Fonts, subset to exactly the characters
 * on the card via `text=` (a few KB each, any script). Without a browser user
 * agent Google answers with TrueType, which Satori can read.
 *
 * Every failure is swallowed: a card in the default font beats no card.
 */
type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 900; style: 'normal' };

async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Literata (headline + body) and Fira Sans Condensed (labels) for `text`. */
export async function gazetteFonts(text: { headline: string; body?: string; label: string }): Promise<OgFont[]> {
  const [serifBlack, serifRegular, label] = await Promise.all([
    loadGoogleFont('Literata', 900, text.headline),
    text.body ? loadGoogleFont('Literata', 400, text.body) : Promise.resolve(null),
    loadGoogleFont('Fira+Sans+Condensed', 600, text.label),
  ]);
  const fonts: OgFont[] = [];
  if (serifBlack) fonts.push({ name: 'Literata', data: serifBlack, weight: 900, style: 'normal' });
  if (serifRegular) fonts.push({ name: 'Literata', data: serifRegular, weight: 400, style: 'normal' });
  if (label) fonts.push({ name: 'Fira Sans Condensed', data: label, weight: 600, style: 'normal' });
  return fonts;
}

/** Gazette colours, inlined — Satori cannot read CSS variables. */
export const OG = {
  paper: '#f3efe6',
  ink: '#111111',
  caption: '#57524a',
  hairline: '#cfc8b8',
  vermilion: '#c8321e',
} as const;
