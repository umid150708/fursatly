/**
 * Structured data for the homepage. Google reads the WebSite node to decide
 * the site name it shows above results ("Fursatly", not "fursatly.uz"), and
 * the Organization node ties the brand to its logo and Telegram channel, so a
 * search for just "fursatly" has an entity to match. Both live on the
 * homepage only, as Google's site-name docs ask.
 */

export const SITE_URL = 'https://fursatly.uz';

export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Fursatly',
        alternateName: ['Fursatly.uz', 'fursatly.uz'],
        url: `${SITE_URL}/`,
        inLanguage: ['en', 'uz', 'ru'],
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Fursatly',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon.png`,
        sameAs: ['https://t.me/fursatly'],
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">. `<` is escaped so no value
 *  can ever close the script tag early. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
