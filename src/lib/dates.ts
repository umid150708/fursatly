import type { Locale } from './translations';

/* Month abbreviations for datelines. A fixed table rather than Intl: the
   server and the browser can ship different ICU data, and a date that renders
   differently on each side is a hydration mismatch. */
export const MONTHS: Record<Locale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};

/** "9 Oct 2026" — unambiguous in every locale, unlike 09/10/2026. */
export function formatDate(iso: string | Date, locale: Locale): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return `${d.getDate()} ${MONTHS[locale][d.getMonth()]} ${d.getFullYear()}`;
}

/** An age range for display; a missing or 0–100 range means "open to all". */
export function formatAges(min: number | null | undefined, max: number | null | undefined, years: string, anyAge: string): string {
  const lo = min ?? 0;
  const hi = max ?? 100;
  if (lo <= 0 && hi >= 100) return anyAge;
  if (hi >= 100) return `${lo}+ ${years}`;
  return `${lo}–${hi} ${years}`;
}

const WEEKDAYS: Record<Locale, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
};

const MONTHS_LONG: Record<Locale, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  // Genitive, as a date is written: "28 сентября".
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
};

/**
 * The masthead dateline: "Monday, 28 September 2026" / "Dushanba, 28-sentabr,
 * 2026" / "Понедельник, 28 сентября 2026". Built from tables rather than Intl
 * because browsers ship little or no Uzbek date data — Chrome printed
 * "2026 M09 28, Mon".
 */
export function formatDateline(d: Date, locale: Locale): string {
  const day = WEEKDAYS[locale][d.getDay()];
  const month = MONTHS_LONG[locale][d.getMonth()];
  if (locale === 'uz') return `${day}, ${d.getDate()}-${month}, ${d.getFullYear()}`;
  return `${day}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

/**
 * A deadline as epoch ms, for comparisons. The DB stores deadlines without a
 * zone ("2026-10-06T00:00:00"), which `Date.parse` reads as LOCAL time — so the
 * server (UTC) and a browser in Tashkent (UTC+5) would disagree by five hours
 * and bucket the same listing differently. Zone-less values are read as UTC.
 */
export function deadlineMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

/**
 * The deadline to store for a scraped post. Posts often give "25-oktabr" with no
 * year, and the extraction model guesses one; a guess in the past would file a
 * live listing as expired and slip past the duplicate check as another edition.
 * A past date whose year the post never mentions moves to the next time that
 * month and day come round. A year the post does state is kept.
 */
export function resolveDeadlineYear(deadline: string, postText: string, now: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline);
  if (!m) return deadline;
  const [, year, month, day] = m;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const at = (y: number) => Date.UTC(y, Number(month) - 1, Number(day));
  if (at(Number(year)) >= today || postText.includes(year)) return deadline;

  for (let y = now.getUTCFullYear(); y <= now.getUTCFullYear() + 4; y++) {
    const d = new Date(at(y));
    if (d.getUTCDate() !== Number(day)) continue; // 29 February in a common year
    if (d.getTime() >= today) return `${y}-${month}-${day}${deadline.slice(10)}`;
  }
  return deadline;
}

/** Whole days until a deadline (ceil), or null when there is none. */
export function daysUntil(iso: string | null | undefined, now: number): number | null {
  const ms = deadlineMs(iso);
  return Number.isNaN(ms) ? null : Math.ceil((ms - now) / 86_400_000);
}

/** "Closes today" / "1 day left" / "12 days left" — singular and today handled. */
export function daysLeftLabel(
  days: number,
  t: { deadlineToday: string; deadline1Day: string; daysLeft: string },
): string {
  if (days <= 0) return t.deadlineToday;
  if (days === 1) return t.deadline1Day;
  return `${days} ${t.daysLeft}`;
}
