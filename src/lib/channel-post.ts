import { eventSlug } from './event-path';

/**
 * Pure builder for the public-channel Telegram post (HTML parse mode) —
 * extracted from the broadcast cron so the formatting and escaping are
 * unit-testable. One trilingual (UZ / RU / EN) card per opportunity, built
 * from already-enriched DB fields (no LLM calls).
 *
 * Written to read like a social post, not a database row: it leads with the
 * concrete benefit (money / funding), gives one tight sentence per language,
 * and strips the title-echo the enrichment LLM tends to open descriptions with.
 */

const SITE = 'https://fursatly.uz';

const CATEGORY: Record<string, { emoji: string; uz: string; ru: string; en: string; tag: string }> = {
  Scholarships:      { emoji: '🎓', uz: 'GRANT',        ru: 'ГРАНТ',           en: 'SCHOLARSHIP',   tag: 'Scholarship' },
  Competitions:      { emoji: '🏆', uz: 'MUSOBAQA',     ru: 'КОНКУРС',         en: 'COMPETITION',   tag: 'Competition' },
  'Summer Programs': { emoji: '☀️', uz: 'YOZGI DASTUR', ru: 'ЛЕТНЯЯ ПРОГРАММА', en: 'SUMMER PROGRAM', tag: 'SummerProgram' },
  Research:          { emoji: '🔬', uz: 'TADQIQOT',     ru: 'ИССЛЕДОВАНИЕ',    en: 'RESEARCH',      tag: 'Research' },
  Volunteer:         { emoji: '🤝', uz: 'VOLONTYORLIK', ru: 'ВОЛОНТЁРСТВО',    en: 'VOLUNTEER',     tag: 'Volunteer' },
  STEM:              { emoji: '💻', uz: 'STEM',         ru: 'STEM',            en: 'STEM',          tag: 'STEM' },
  Internships:       { emoji: '💼', uz: 'STAJIROVKA',   ru: 'СТАЖИРОВКА',      en: 'INTERNSHIP',    tag: 'Internship' },
  Workshops:         { emoji: '📚', uz: 'SEMINAR',      ru: 'СЕМИНАР',         en: 'WORKSHOP',      tag: 'Workshop' },
  Fellowships:       { emoji: '🌍', uz: 'STIPENDIYA',   ru: 'СТИПЕНДИЯ',       en: 'FELLOWSHIP',    tag: 'Fellowship' },
  Other:             { emoji: '✨', uz: 'IMKONIYAT',    ru: 'ВОЗМОЖНОСТЬ',     en: 'OPPORTUNITY',   tag: 'Opportunity' },
};

const escText = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const trim = (s = '', n = 150) => {
  const t = s.trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

/** Leading article words in the three languages, so title-echo stripping and
 *  capitalisation work whichever language the description is in. */
const LEADING_ARTICLE = /^(the|a|an|ushbu| this|bu|mazkur|этот|эта|это|данн\w+)\s+/i;

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
      d = d.replace(/^[\s.,:;—–-]+/, '').replace(/^(is|are|was|were|will be|—|-|это|—\s)\s*/i, '');
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
    return `💰 ${escText(trim(clean, 110))}`;
  }
  if (rd.funding_type === 'Full') return `💰 To'liq moliyalashtirilgan / Полностью финансируется / Fully funded`;
  return null;
}

/** The fursatly.uz details link (also the OG-preview source when previews on). */
export const detailsUrl = (ev: any): string => `${SITE}/event/${eventSlug(ev)}`;

/**
 * Only enriched events make good channel posts — a raw scraped row has no
 * extended description and no translations, so the card would be three bare
 * title lines. Wait for the enrich cron to finish it first.
 */
export function isPostable(ev: any): boolean {
  const rd = ev?.research_data || {};
  return Boolean(rd.extendedDescription || rd.translations?.uz?.title);
}

export function buildPost(ev: any): string {
  const rd = ev.research_data || {};
  const cat = CATEGORY[ev.source] || CATEGORY.Other;
  const uz = rd.translations?.uz || {};
  const ru = rd.translations?.ru || {};

  const L: string[] = [];
  L.push(`${cat.emoji} <b>${cat.uz} / ${cat.ru} / ${cat.en}</b>`);

  const hl = highlight(ev);
  if (hl) L.push(hl);
  L.push('');

  // One flag + bold title + tight one-line hook per language.
  const block = (flag: string, title: string, h: string) => {
    L.push(`${flag} <b>${escText(title)}</b>`);
    if (h) L.push(escText(h));
  };
  block('🇺🇿', uz.title || ev.title, hook(uz.extendedDescription || rd.extendedDescription, uz.title, ev.title));
  L.push('');
  block('🇷🇺', ru.title || ev.title, hook(ru.extendedDescription || rd.extendedDescription, ru.title, ev.title));
  L.push('');
  block('🇬🇧', ev.title, hook(rd.extendedDescription, ev.title, ev.title));
  L.push('');

  // Facts line mirrors the website card (location · age · language).
  const meta: string[] = [];
  if (ev.location) meta.push(`📍 ${escText(ev.location)}`);
  if (!(ev.age_min === 0 && ev.age_max === 100) && (ev.age_min || ev.age_max)) meta.push(`👤 ${ev.age_min}–${ev.age_max}`);
  if (ev.language) meta.push(`🗣 ${escText(ev.language)}`);
  if (meta.length) L.push(meta.join('  ·  '));

  const dl = daysLeft(ev.deadline);
  const urgent = dl !== null && dl >= 0 && dl <= 7;
  const clock = urgent ? '🔴' : '⏳';
  const soon = urgent ? (dl === 0 ? ' (bugun / сегодня / today!)' : ` (${dl} kun / дн. / days left!)`) : '';
  L.push(`${clock} Muddat / Дедлайн / Deadline: <b>${fmtDate(ev.deadline)}</b>${soon}`);
  L.push('');

  const url = applyUrl(ev);
  if (url) L.push(`🔗 <a href="${escAttr(url)}">Ariza / Заявка / Apply</a>`);
  L.push(`👉 <a href="${detailsUrl(ev)}">Batafsil / Подробнее / Details</a>`);
  L.push('');
  L.push(`#${cat.tag} #Fursatly #imkoniyat`);
  return L.join('\n');
}
