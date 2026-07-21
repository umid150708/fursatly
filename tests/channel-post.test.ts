import { describe, it, expect } from 'vitest';
import { buildPost, isPostable, detailsUrl } from '../src/lib/channel-post';

const enriched = {
  id: '0f01ae61-ab70-4c8f-825b-bd97aa559a2a',
  title: 'KAIST Scholarships <2026>',
  description: 'Apply at https://kaist.ac.kr/apply now',
  location: 'South Korea',
  deadline: '2099-10-22', // far future so it's never "urgent" in these tests
  source: 'Scholarships',
  age_min: 17,
  age_max: 25,
  language: 'English',
  research_data: {
    slug: 'kaist-scholarships-2026',
    extendedDescription: 'KAIST Scholarships <2026> provides a full tuition waiver to students.',
    officialWebsite: 'https://kaist.ac.kr/apply',
    keyDetails: ['Covers full tuition and a $3,000 monthly stipend for 4 years'],
    translations: {
      uz: { title: 'KAIST granti', extendedDescription: 'KAIST granti to‘liq o‘qish grantini beradi.' },
      ru: { title: 'Грант KAIST', extendedDescription: 'Грант KAIST даёт полное финансирование.' },
    },
  },
};

describe('isPostable', () => {
  it('accepts an enriched event', () => {
    expect(isPostable(enriched)).toBe(true);
  });

  it('rejects a raw scraped row with no enrichment', () => {
    expect(isPostable({ ...enriched, research_data: {} })).toBe(false);
    expect(isPostable({ ...enriched, research_data: null })).toBe(false);
  });
});

describe('detailsUrl', () => {
  it('uses the slug when present', () => {
    expect(detailsUrl(enriched)).toBe('https://fursatly.uz/event/kaist-scholarships-2026');
  });

  it('falls back to the UUID when no slug exists', () => {
    expect(detailsUrl({ ...enriched, research_data: {} })).toBe(`https://fursatly.uz/event/${enriched.id}`);
  });
});

describe('buildPost', () => {
  const post = buildPost(enriched);

  it('renders all three language titles', () => {
    expect(post).toContain('KAIST granti');
    expect(post).toContain('Грант KAIST');
    expect(post).toContain('KAIST Scholarships');
  });

  it('escapes HTML-sensitive characters in titles', () => {
    expect(post).toContain('&lt;2026&gt;');
    expect(post).not.toContain('<b>KAIST Scholarships <2026>');
  });

  it('strips the title echo the LLM opens descriptions with', () => {
    // English hook should start with the benefit, not restate the title.
    expect(post).toContain('Provides a full tuition waiver to students.');
    expect(post).not.toContain('KAIST Scholarships &lt;2026&gt; provides');
  });

  it('leads with a money highlight drawn from keyDetails', () => {
    expect(post).toContain('💰');
    expect(post).toContain('$3,000');
  });

  it('formats the deadline as dd.mm.yyyy', () => {
    expect(post).toContain('22.10.2099');
  });

  it('links apply + details URLs', () => {
    expect(post).toContain('href="https://kaist.ac.kr/apply"');
    expect(post).toContain('href="https://fursatly.uz/event/kaist-scholarships-2026"');
  });

  it('shows Rolling for missing deadlines', () => {
    expect(buildPost({ ...enriched, deadline: null })).toContain('Rolling');
  });

  it('flags urgency when the deadline is within a week', () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const urgentPost = buildPost({ ...enriched, deadline: soon });
    expect(urgentPost).toContain('🔴');
    expect(urgentPost).toMatch(/days left/);
  });

  it('falls back to the "fully funded" badge when no money keyDetail exists', () => {
    const noDetails = buildPost({
      ...enriched,
      research_data: { ...enriched.research_data, keyDetails: [], funding_type: 'Full' },
    });
    expect(noDetails).toContain('Fully funded');
  });

  it('falls back to the English title when a translation is missing', () => {
    const noTr = buildPost({
      ...enriched,
      research_data: { ...enriched.research_data, translations: {} },
    });
    expect(noTr).toContain('🇺🇿 <b>KAIST Scholarships &lt;2026&gt;</b>');
  });
});
