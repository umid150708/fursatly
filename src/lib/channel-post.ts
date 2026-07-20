import { eventSlug } from './event-path';

/**
 * Pure builder for the public-channel Telegram post (HTML parse mode) —
 * extracted from the broadcast cron so the formatting and escaping are
 * unit-testable. One trilingual (UZ / RU / EN) card per opportunity, with the
 * event's fursatly.uz link carrying the OG preview card.
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
const trim = (s = '', n = 200) => {
  const t = s.trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

const fmtDate = (d: string | null) => {
  if (!d) return 'Rolling';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Rolling';
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

function applyUrl(ev: any): string | null {
  const rd = ev.research_data || {};
  if (typeof rd.officialWebsite === 'string' && /^https?:\/\//.test(rd.officialWebsite)) return rd.officialWebsite;
  const m = (ev.description || '').match(/https?:\/\/[^\s)\]]+/);
  return m ? m[0] : null;
}

/** The fursatly.uz details link — also what the OG preview card renders from. */
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
  L.push('');
  L.push(`🇺🇿 <b>${escText(uz.title || ev.title)}</b>`);
  const dUz = trim(uz.extendedDescription || rd.extendedDescription || '');
  if (dUz) L.push(escText(dUz));
  L.push('');
  L.push(`🇷🇺 <b>${escText(ru.title || ev.title)}</b>`);
  const dRu = trim(ru.extendedDescription || rd.extendedDescription || '');
  if (dRu) L.push(escText(dRu));
  L.push('');
  L.push(`🇬🇧 <b>${escText(ev.title)}</b>`);
  const dEn = trim(rd.extendedDescription || '');
  if (dEn) L.push(escText(dEn));
  L.push('');
  // Meta line mirrors the website card (location · age · language).
  const meta: string[] = [];
  if (ev.location) meta.push(`📍 ${escText(ev.location)}`);
  if (!(ev.age_min === 0 && ev.age_max === 100)) meta.push(`👤 ${ev.age_min}–${ev.age_max}`);
  if (ev.language) meta.push(`🗣 ${escText(ev.language)}`);
  if (meta.length) L.push(meta.join('  ·  '));
  L.push(`⏳ Muddat / Дедлайн / Deadline: <b>${fmtDate(ev.deadline)}</b>`);
  if (rd.funding_type === 'Full') L.push(`✅ To'liq moliyalashtirilgan / Полное финансирование / Fully funded`);
  L.push('');
  const url = applyUrl(ev);
  if (url) L.push(`🔗 <a href="${escAttr(url)}">Ariza / Заявка / Apply</a>`);
  L.push(`👉 <a href="${detailsUrl(ev)}">Batafsil / Подробнее / Details</a>`);
  L.push('');
  L.push(`#${cat.tag} #Fursatly #imkoniyat`);
  return L.join('\n');
}
