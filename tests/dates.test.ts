import { describe, it, expect } from 'vitest';
import { formatDate, formatAges, formatDateline, deadlineMs, daysUntil, daysLeftLabel } from '../src/lib/dates';

describe('formatDate', () => {
  it('writes day, month abbreviation and year in each locale', () => {
    const d = new Date(2026, 9, 9);
    expect(formatDate(d, 'en')).toBe('9 Oct 2026');
    expect(formatDate(d, 'uz')).toBe('9 Okt 2026');
    expect(formatDate(d, 'ru')).toBe('9 окт 2026');
  });
});

describe('formatAges', () => {
  it('treats a missing or 0–100 range as open to all ages', () => {
    expect(formatAges(0, 100, 'years', 'Any age')).toBe('Any age');
    expect(formatAges(null, null, 'years', 'Any age')).toBe('Any age');
  });
  it('shows a lower bound alone when there is no upper one', () => {
    expect(formatAges(18, 100, 'years', 'Any age')).toBe('18+ years');
  });
  it('shows a real range as a range', () => {
    expect(formatAges(14, 17, 'years', 'Any age')).toBe('14–17 years');
  });
});

describe('formatDateline', () => {
  it('writes the full dateline in each locale', () => {
    const d = new Date(2026, 8, 28); // a Monday
    expect(formatDateline(d, 'en')).toBe('Monday, 28 September 2026');
    expect(formatDateline(d, 'uz')).toBe('Dushanba, 28-sentabr, 2026');
    expect(formatDateline(d, 'ru')).toBe('Понедельник, 28 сентября 2026');
  });
});

describe('deadlineMs / daysUntil', () => {
  it('reads zone-less deadlines as UTC so every timezone agrees', () => {
    expect(deadlineMs('2026-10-06T00:00:00')).toBe(Date.UTC(2026, 9, 6));
    expect(deadlineMs('2026-10-06T00:00:00Z')).toBe(Date.UTC(2026, 9, 6));
    expect(deadlineMs('2026-10-06T00:00:00+05:00')).toBe(Date.UTC(2026, 9, 5, 19));
    expect(Number.isNaN(deadlineMs(null))).toBe(true);
  });
  it('counts whole days up', () => {
    expect(daysUntil('2026-10-06T00:00:00', Date.UTC(2026, 9, 4, 9))).toBe(2);
    expect(daysUntil(null, 0)).toBeNull();
  });
});

describe('daysLeftLabel', () => {
  const t = { deadlineToday: 'Closes today', deadline1Day: '1 day left', daysLeft: 'days left' };
  it('handles today, one day, and many', () => {
    expect(daysLeftLabel(0, t)).toBe('Closes today');
    expect(daysLeftLabel(1, t)).toBe('1 day left');
    expect(daysLeftLabel(5, t)).toBe('5 days left');
  });
});
