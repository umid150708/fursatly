/** Unit tests for the mentor prompt builder — pure string composition. */
import { describe, it, expect } from 'vitest';
import {
  trimHistory,
  extractMentorEvent,
  buildMentorPrompt,
  type ChatMessage,
} from '../src/lib/mentor-prompt';

const msgs = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `m${i}`,
  }));

describe('trimHistory', () => {
  it('keeps the last 16 messages by default', () => {
    const out = trimHistory(msgs(20));
    expect(out).toHaveLength(16);
    expect(out[0].content).toBe('m4');
    expect(out[15].content).toBe('m19');
  });
  it('returns everything when under the cap', () => {
    expect(trimHistory(msgs(3))).toHaveLength(3);
  });
});

describe('extractMentorEvent', () => {
  it('maps event columns + research_data into clean facts', () => {
    const ev = extractMentorEvent({
      title: 'Chevening',
      deadline: '2026-11-01',
      description: 'fallback desc',
      research_data: {
        organisation: 'UK Gov',
        officialWebsite: 'https://chevening.org',
        extendedDescription: 'Full scholarship',
        keyDetails: ['Fully funded', { text: 'Any UK university' }],
        competitionTips: ['Start early'],
        eligibilityCriteria: ['2 years work experience'],
      },
    });
    expect(ev.title).toBe('Chevening');
    expect(ev.organisation).toBe('UK Gov');
    expect(ev.officialWebsite).toBe('https://chevening.org');
    expect(ev.keyDetails).toEqual(['Fully funded', 'Any UK university']);
    expect(ev.benefits).toEqual(['Start early']);
    expect(ev.eligibility).toEqual(['2 years work experience']);
  });
  it('falls back to description when extendedDescription is missing', () => {
    const ev = extractMentorEvent({ title: 'X', description: 'plain', research_data: {} });
    expect(ev.extendedDescription).toBe('plain');
  });
  it('tolerates a null research_data', () => {
    const ev = extractMentorEvent({ title: 'X', description: 'd', research_data: null });
    expect(ev.title).toBe('X');
    expect(ev.keyDetails).toEqual([]);
  });
});

describe('deadline formatting in the prompt', () => {
  it('trims a stored timestamp down to the date and labels it plainly', () => {
    const p = buildMentorPrompt({
      event: { title: 'X', deadline: '2026-07-31T00:00:00' },
      profile: null,
      messages: [{ role: 'user', content: 'when?' }],
      locale: 'en',
    });
    expect(p).toContain('Application deadline: 2026-07-31');
    expect(p).not.toContain('2026-07-31T00:00:00');
  });
});

describe('buildMentorPrompt', () => {
  const event = {
    title: 'Chevening',
    deadline: '2026-11-01',
    officialWebsite: 'https://chevening.org',
    eligibility: ['2 years work experience'],
  };

  it('grounds the prompt in the opportunity facts', () => {
    const p = buildMentorPrompt({ event, profile: null, messages: msgs(1), locale: 'en' });
    expect(p).toContain('Chevening');
    expect(p).toContain('2026-11-01');
    expect(p).toContain('https://chevening.org');
    expect(p).toContain('2 years work experience');
    expect(p).toContain('No profile details available');
  });

  it('includes profile fields when present', () => {
    const p = buildMentorPrompt({
      event,
      profile: { display_name: 'Aziz', age: 17, country: 'Uzbekistan', interests: ['CS'], savedCount: 4 },
      messages: msgs(1),
      locale: 'en',
    });
    expect(p).toContain('Aziz');
    expect(p).toContain('17');
    expect(p).toContain('Uzbekistan');
    expect(p).toContain('CS');
  });

  it('names the reply language from locale', () => {
    expect(buildMentorPrompt({ event, profile: null, messages: msgs(1), locale: 'uz' })).toContain('Uzbek');
    expect(buildMentorPrompt({ event, profile: null, messages: msgs(1), locale: 'ru' })).toContain('Russian');
  });

  it('includes guardrail lines and the transcript', () => {
    const p = buildMentorPrompt({
      event,
      profile: null,
      messages: [{ role: 'user', content: 'Am I eligible?' }],
      locale: 'en',
    });
    expect(p).toContain('Never invent');
    expect(p).toContain('Student: Am I eligible?');
    expect(p.trimEnd().endsWith('Mentor:')).toBe(true);
  });
});
