/**
 * Paid promotions reached the site: "American University of Technology Open
 * Day" carried utm_source=telegram_paid, and the Youth Action Summit link came
 * from a Google Ads click (gclid). Posts carrying a paid-placement marker are
 * dropped before the extraction model ever sees them.
 */
import { describe, it, expect } from 'vitest';
import { paidPromotionMarker } from '../src/pipeline/promo.mjs';

describe('paidPromotionMarker', () => {
  it.each([
    ['https://aut-edu.uz/openday?utm_source=telegram_paid&utm_medium=openday_uz', 'utm_source=telegram_paid'],
    ['https://x.uz/?utm_medium=cpc&utm_source=tg', 'utm_medium=cpc'],
    ['https://x.uz/?utm_campaign=paid-ads', 'utm_campaign=paid-ads'],
    ['https://thecda.co/summit/?gad_source=1&gclid=CjwKCAjw', 'gad_source=1'],
    ['https://x.uz/?gclid=abc', 'gclid=abc'],
    ['Qabul davom etmoqda!\n#reklama', '#reklama'],
    ['Grant bor\n\nReklama\n', 'Reklama'],
    ['Скидка 20%\n#реклама', '#реклама'],
    ['Big news #sponsored', '#sponsored'],
  ])('flags %s', (text, marker) => {
    expect(paidPromotionMarker(text)).toBe(marker);
  });

  it.each([
    'Chevening: full scholarship. https://www.chevening.org/apply/',
    'https://iau-admission.tilda.ws/?utm_source=unihub',
    'Reklama tanlovi: eng yaxshi reklama roligi uchun 5 mln so‘m',
    'https://grantlar.uz/chevening/?utm_source=telegram',
    '',
  ])('leaves %s alone', (text) => {
    expect(paidPromotionMarker(text)).toBeNull();
  });
});
