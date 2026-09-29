/**
 * Fursatly — paid-placement markers in scraped posts.
 *
 * Channels are paid to run adverts, and those posts look like opportunities:
 * "American University of Technology Open Day" arrived with
 * utm_source=telegram_paid, and a summit link came straight from a Google Ads
 * click (gclid). Nobody pays Fursatly to list anything, so a post that carries
 * a paid-placement marker is dropped before the extraction model sees it.
 *
 * Pure functions, no imports — identical under Next's bundler and bare `node`.
 */

/** A tracking parameter whose value says the click was bought. */
const PAID_UTM = /\butm_(?:source|medium|campaign)=[^&\s#]*?(?<![a-z])(?:paid|cpc|ppc|ads?|sponsored|reklama)(?![a-z])[^&\s#]*/i;
/** Google Ads click identifiers: the link was copied from an ad. */
const AD_CLICK = /\b(?:gclid|gad_source|gbraid|wbraid)=[^&\s#]*/i;
/** A channel's own advert label: a hashtag, or "Reklama" alone on a line. */
const AD_LABEL = /#(?:reklama|реклама|ad|ads|sponsored)(?![\p{L}\p{N}_])|^[ \t]*(?:reklama|реклама)[ \t]*$/imu;

/**
 * The paid-placement marker found in a post, or null for an organic post.
 * @param {string} text
 * @returns {string | null}
 */
export function paidPromotionMarker(text) {
  const s = String(text ?? '');
  for (const re of [PAID_UTM, AD_CLICK, AD_LABEL]) {
    const m = re.exec(s);
    if (m) return m[0].trim();
  }
  return null;
}
