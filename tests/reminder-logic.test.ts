/** Unit tests for reminder window selection — pure date math, no DB. */
import { describe, it, expect } from 'vitest';
import { dueLabel, selectDueReminders, sentKey } from '../src/lib/reminder-logic';

const NOW = new Date('2026-07-17T09:00:00Z');
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe('dueLabel', () => {
  it('null when the deadline already passed', () => {
    expect(dueLabel(hoursFromNow(-1), NOW)).toBeNull();
  });
  it("'1d' within 24h", () => {
    expect(dueLabel(hoursFromNow(12), NOW)).toBe('1d');
    expect(dueLabel(hoursFromNow(24), NOW)).toBe('1d');
  });
  it("'3d' between 1 and 3 days", () => {
    expect(dueLabel(hoursFromNow(25), NOW)).toBe('3d');
    expect(dueLabel(hoursFromNow(72), NOW)).toBe('3d');
  });
  it('null beyond 3 days', () => {
    expect(dueLabel(hoursFromNow(73), NOW)).toBeNull();
  });
});

describe('selectDueReminders', () => {
  it('picks the right window per candidate and skips already-sent ones', () => {
    const candidates = [
      { savedId: 'a', deadline: hoursFromNow(12) },  // 1d due
      { savedId: 'b', deadline: hoursFromNow(48) },  // 3d due
      { savedId: 'c', deadline: hoursFromNow(48) },  // 3d already sent
      { savedId: 'd', deadline: hoursFromNow(200) }, // out of window
      { savedId: 'e', deadline: hoursFromNow(-5) },  // passed
    ];
    const sent = new Set([sentKey('c', '3d')]);
    const due = selectDueReminders(candidates, sent, NOW);
    expect(due.map((d) => `${d.savedId}:${d.label}`)).toEqual(['a:1d', 'b:3d']);
  });

  it("a '3d' send does not block the later '1d' send", () => {
    // 3d already recorded; deadline now inside 1d — the 1d ping still fires.
    const sent = new Set([sentKey('a', '3d')]);
    const due = selectDueReminders([{ savedId: 'a', deadline: hoursFromNow(20) }], sent, NOW);
    expect(due).toHaveLength(1);
    expect(due[0].label).toBe('1d');
  });

  it('late saves (inside 1d) get only the 1d reminder', () => {
    const due = selectDueReminders([{ savedId: 'x', deadline: hoursFromNow(6) }], new Set(), NOW);
    expect(due.map((d) => d.label)).toEqual(['1d']);
  });

  it('daysLeft is a human-friendly ceil, minimum 1', () => {
    const due = selectDueReminders([{ savedId: 'x', deadline: hoursFromNow(6) }], new Set(), NOW);
    expect(due[0].daysLeft).toBe(1);
    const due3 = selectDueReminders([{ savedId: 'y', deadline: hoursFromNow(60) }], new Set(), NOW);
    expect(due3[0].daysLeft).toBe(3);
  });
});
