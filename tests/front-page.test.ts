/**
 * Front-page selection: which story leads, what runs in "Closing this week",
 * what goes "In brief", and the deadline forecast counts. The server page and
 * the client both call these, so they must be pure and agree for the same
 * reference time.
 */
import { describe, it, expect } from 'vitest';
import { pickLead, closingThisWeek, inBrief, deadlineForecast } from '../src/lib/front-page';

const NOW = Date.parse('2026-09-28T09:00:00Z');
const DAY = 86_400_000;
const ev = (id: string, days: number | null, funding: string | null = null) => ({
  id,
  deadline: days === null ? null : new Date(NOW + days * DAY).toISOString(),
  research_data: { funding_type: funding },
});

const events = [
  ev('rolling', null),
  ev('closing-2d', 2, 'Partial'),
  ev('closing-5d-full', 5, 'Full'),
  ev('full-11d', 11, 'Full'),
  ev('full-35d', 35, 'Full'),
  ev('open-9d', 9),
  ev('open-20d', 20),
  ev('past', -1, 'Full'),
];

describe('pickLead', () => {
  it('leads with the soonest fully funded deadline beyond this week', () => {
    expect(pickLead(events, NOW)?.id).toBe('full-11d');
  });

  it('falls back to the soonest fully funded one when all close this week', () => {
    expect(pickLead([ev('a', 3, 'Full'), ev('b', 6, 'Full')], NOW)?.id).toBe('a');
  });

  it('falls back to the soonest upcoming deadline when nothing is fully funded', () => {
    expect(pickLead([ev('late', 30), ev('soon', 8), ev('r', null)], NOW)?.id).toBe('soon');
  });

  it('never leads with a deadline that has passed, and copes with an empty list', () => {
    expect(pickLead([ev('past', -2, 'Full'), ev('r', null)], NOW)?.id).toBe('r');
    expect(pickLead([], NOW)).toBeNull();
  });
});

describe('closingThisWeek', () => {
  it('lists deadlines inside the next seven days, soonest first', () => {
    expect(closingThisWeek(events, NOW).map((e) => e.id)).toEqual(['closing-2d', 'closing-5d-full']);
  });
});

describe('inBrief', () => {
  it('runs the next fully funded stories, skipping ones already on the page', () => {
    const lead = pickLead(events, NOW)!;
    const exclude = new Set([lead.id, ...closingThisWeek(events, NOW).map((e) => e.id)]);
    expect(inBrief(events, NOW, exclude, 3).map((e) => e.id)).toEqual(['full-35d', 'open-9d', 'open-20d']);
  });
});

describe('deadlineForecast', () => {
  it('buckets every open listing exactly once', () => {
    expect(deadlineForecast(events, NOW)).toEqual({ thisWeek: 2, nextWeek: 2, later: 2, rolling: 1 });
  });
});
