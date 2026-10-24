import { eventSlug } from './event-path';

/**
 * Pure builder for the public-channel Telegram post (HTML parse mode) —
 * extracted from the broadcast cron so the formatting and escaping are
 * unit-testable. One bilingual (UZ / EN) card per opportunity, built
 * from already-enriched DB fields (no LLM calls).
 *
 * Written to read like a social post, not a database row: title, then the
 * facts students scan for (money, place, deadline) boxed in a quote, then one
 * tight sentence per language with the title-echo the enrichment LLM tends to
 * open descriptions with stripped. No links in the text — apply/details ride
 * as inline buttons under the post (`postButtons`).
 */

const SITE = 'https://fursatly.uz';
/** Signs every message, so forwards still point back to the channel. */
const CHANNEL = '@fursatly';

const CATEGORY: Record<string, { emoji: string; tag: string }> = {
  Scholarships:      { emoji: '🎓', tag: 'Scholarship' },
  Competitions:      { emoji: '🏆', tag: 'Competition' },
  'Summer Programs': { emoji: '☀️', tag: 'SummerProgram' },
  Research:          { emoji: '🔬', tag: 'Research' },
  Volunteer:         { emoji: '🤝', tag: 'Volunteer' },
  STEM:              { emoji: '💻', tag: 'STEM' },
  Internships:       { emoji: '💼', tag: 'Internship' },
  Workshops:         { emoji: '📚', tag: 'Workshop' },
  Fellowships:       { emoji: '🌍', tag: 'Fellowship' },
  Other:             { emoji: '✨', tag: 'Opportunity' },
};

/**
 * Animated premium (custom) emoji for every plain emoji the posts use. Telegram
 * renders them animated for all readers, Premium or not. Ids come from
 * Telegram's own packs, which won't be deleted: "Animated Emoji"
 * (t.me/addemoji/RestrictedEmoji), plus "News Emoji" (t.me/addemoji/NewsEmoji)
 * for 📍 and 🔴, which the first pack lacks. Keys carry no U+FE0F variation
 * selector; `emo` strips it before the lookup.
 *
 * Only a Premium *user* account can post these to a channel — the bot path
 * runs `stripPremiumEmoji` first (see channel-sender.ts).
 */
const PREMIUM_EMOJI: Record<string, string> = {
  '🎓': '5375163339154399459', '🏆': '5409008750893734809', '☀': '5469947168523558652',
  '🔬': '5379679518740978720', '🤝': '5357080225463149588', '💻': '5431376038628171216',
  '💼': '5359785904535774578', '📚': '5373098009640836781', '🌍': '5399898266265475100',
  '✨': '5472164874886846699', '💰': '5375296873982604963', '👤': '5373012449597335010',
  '🗣': '5370765563226236970', '⏳': '5451732530048802485', '👉': '5471978009449731768', '🔥': '5420315771991497307', '🇺🇿': '5449829434334912605',
  '🇬🇧': '5202196682497859879',
  '📍': '5397782960512444700', '🔴': '5411225014148014586',
};

/** Wrap a plain emoji as premium emoji; the plain one stays as the fallback glyph. */
const emo = (e: string): string => {
  const id = PREMIUM_EMOJI[e.replace(/\uFE0F/g, '')];
  return id ? `<tg-emoji emoji-id="${id}">${e}</tg-emoji>` : e;
};

/** Back to plain emoji, for senders that can't post premium emoji (the bot). */
export const stripPremiumEmoji = (html: string): string =>
  html.replace(/<tg-emoji emoji-id="\d+">(.*?)<\/tg-emoji>/g, '$1');

const escText = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const trim = (s = '', n = 150) => {
  const t = s.trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

/** Leading article words in both languages, so title-echo stripping and
 *  capitalisation work whichever language the description is in. */
const LEADING_ARTICLE = /^(the|a|an|ushbu| this|bu|mazkur)\s+/i;

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * The enrichment LLM almost always opens a description by restating the full
 * title ("The KAIST … Scholarships provide …"), which reads as dead weight
 * right under the bold title. Strip that echo. Translations sometimes keep the
 * English name, so try both the localised and English titles.
 */
function stripTitleEcho(desc: string, titles: (string | undefined)[]): string {
  let d = desc.trim();
  for (const title of titles) {
    if (!title) continue;
    const t = title.trim();
    const stripped = d.replace(LEADING_ARTICLE, '');
    if (stripped.toLowerCase().startsWith(t.toLowerCase())) {
      d = stripped.slice(t.length);
      // Drop the connector left behind ("… Scholarships >is a< / >—< / >:< …").
      d = d.replace(/^[\s.,:;—–-]+/, '').replace(/^(is|are|was|were|will be|—|-|—\s)\s*/i, '');
      return capitalize(d.trim());
    }
  }
  return d;
}

/** First sentence of a blob — a hook, not the whole essay. Falls back to the
 *  trimmed blob when there's no sentence break. */
function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

/** One tight, benefit-first line for a language: title-echo removed, first
 *  sentence only, capped. */
function hook(desc: string | undefined, localTitle: string | undefined, enTitle: string | undefined): string {
  if (!desc) return '';
  return trim(firstSentence(stripTitleEcho(desc, [localTitle, enTitle])), 160);
}

const fmtDate = (d: string | null) => {
  if (!d) return 'Rolling';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Rolling';
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

const daysLeft = (d: string | null): number | null => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
};

function applyUrl(ev: any): string | null {
  const rd = ev.research_data || {};
  if (typeof rd.officialWebsite === 'string' && /^https?:\/\//.test(rd.officialWebsite)) return rd.officialWebsite;
  const m = (ev.description || '').match(/https?:\/\/[^\s)\]]+/);
  return m ? m[0] : null;
}

/**
 * The single most compelling line — what the student actually gets. Prefer a
 * keyDetail that names money/funding (the enrichment prompt puts the real
 * numbers there); fall back to the "fully funded" flag.
 */
function highlight(ev: any): string | null {
  const rd = ev.research_data || {};
  // Real funding signals only. Currency codes need word boundaries — bare
  // "EUR" matched "entreprEURship", and bare "100%" matched "100% online".
  const money = /(\$\d|€\s?\d|£\s?\d|\bUSD\b|\bEUR\b|\bGBP\b|\bKRW\b|\bso'm\b|fully[- ]funded|full scholarship|full tuition|full (cost|funding|financial)|free (tuition|education)|\bstipend\b|cash prize|prize money|covers (the )?full|covering all (program|cost|expense))/i;
  const detail = (rd.keyDetails || []).find((k: any) => typeof k === 'string' && money.test(k));
  if (detail) {
    // Drop the "Prizes:" / "Format:" label the LLM prefixes onto keyDetails.
    const clean = detail.replace(/^[A-Z][A-Za-z ]{1,18}:\s*/, '');
    return `${emo('💰')} ${escText(trim(clean, 110))}`;
  }
  if (rd.funding_type === 'Full') return `${emo('💰')} To'liq moliyalashtirilgan / Fully funded`;
  return null;
}

/** The fursatly.uz details link (also the OG-preview source when previews on). */
export const detailsUrl = (ev: any): string => `${SITE}/event/${eventSlug(ev)}`;

/**
 * Only enriched events make good channel posts — a raw scraped row has no
 * extended description and no translations, so the card would be two bare
 * title lines. Wait for the enrich cron to finish it first.
 */
export function isPostable(ev: any): boolean {
  const rd = ev?.research_data || {};
  return Boolean(rd.extendedDescription || rd.translations?.uz?.title);
}

/**
 * Weekly "closing this week" digest — one compact message listing the events
 * with the soonest upcoming deadlines. A ritual on top of the daily
 * per-opportunity posts. Caller passes already-filtered, soonest-first events.
 */
export function buildDigest(events: any[]): string {
  const L: string[] = [];
  L.push(`${emo('🔥')} <b>Shu hafta tugaydigan imkoniyatlar</b>`);
  L.push(`${emo('🔥')} <b>Closing this week</b>`);
  L.push('');

  for (const ev of events) {
    const cat = CATEGORY[ev.source] || CATEGORY.Other;
    const dl = daysLeft(ev.deadline);
    const dot = dl !== null && dl <= 3 ? `${emo('🔴')} ` : '';
    const left = dl === 0 ? 'bugun / today!' : dl === 1 ? '1 kun / day' : `${dl} kun / days`;
    L.push(`${emo(cat.emoji)} <a href="${detailsUrl(ev)}">${escText(ev.title)}</a>`);
    L.push(`   ${dot}${emo('⏳')} ${fmtDate(ev.deadline)} · ${left}`);
  }

  L.push('');
  L.push(`${emo('👉')} <a href="${SITE}">Barchasi / All → fursatly.uz</a>`);
  L.push(`#deadline #Fursatly #imkoniyat`);
  L.push(CHANNEL);
  return L.join('\n');
}

export type PostButton = { text: string; url: string };

/** Apply + details links, attached under the post as inline URL buttons. */
export function postButtons(ev: any): PostButton[] {
  const url = applyUrl(ev);
  return [
    ...(url ? [{ text: '📝 Ariza / Apply', url }] : []),
    { text: '🔎 Batafsil / Details', url: detailsUrl(ev) },
  ];
}

/** The same links as text, for when buttons can't be attached. */
export const buttonsAsLinks = (buttons: PostButton[]): string =>
  buttons.map((b) => `<a href="${escAttr(b.url)}">${escText(b.text)}</a>`).join('\n');

export function buildPost(ev: any): string {
  const rd = ev.research_data || {};
  const cat = CATEGORY[ev.source] || CATEGORY.Other;
  const uz = rd.translations?.uz || {};

  // Key facts box: money, then the website card's facts (location · age ·
  // language), then the deadline.
  const facts: string[] = [];
  const hl = highlight(ev);
  if (hl) facts.push(hl);

  const meta: string[] = [];
  if (ev.location) meta.push(`${emo('📍')} ${escText(ev.location)}`);
  if (!(ev.age_min === 0 && ev.age_max === 100) && (ev.age_min || ev.age_max)) meta.push(`${emo('👤')} ${ev.age_min}–${ev.age_max}`);
  if (ev.language) meta.push(`${emo('🗣')} ${escText(ev.language)}`);
  if (meta.length) facts.push(meta.join('  ·  '));

  const dl = daysLeft(ev.deadline);
  const urgent = dl !== null && dl >= 0 && dl <= 7;
  const clock = emo(urgent ? '🔴' : '⏳');
  const soon = urgent ? (dl === 0 ? ' (bugun / today!)' : ` (${dl} kun / days left!)`) : '';
  facts.push(`${clock} Deadline: <b>${fmtDate(ev.deadline)}</b>${soon}`);

  // One tight hook per language. A missing translation is skipped rather than
  // repeating the English under another flag.
  const hooks = [
    uz.extendedDescription && [emo('🇺🇿'), hook(uz.extendedDescription, uz.title, ev.title)],
    [emo('🇬🇧'), hook(rd.extendedDescription, ev.title, ev.title)],
  ]
    .filter((h): h is string[] => Boolean(h && h[1]))
    .map(([flag, h]) => `${flag} ${escText(h)}`);

  const L: string[] = [];
  L.push(`${emo(cat.emoji)} <b>${escText(ev.title)}</b>`);
  L.push(`<blockquote>${facts.join('\n')}</blockquote>`);
  if (hooks.length) L.push(hooks.join('\n\n'), '');
  L.push(`#${cat.tag} #Fursatly`);
  L.push(CHANNEL);
  return L.join('\n');
}
