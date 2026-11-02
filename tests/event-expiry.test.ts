import { describe, it, expect } from 'vitest';
import { isExpired, openDeadlineFilter } from '../src/lib/dates';

// Zone-less, as the DB stores deadlines: this is 04:13:43 UTC.
const deadline = '2026-11-02T04:13:43.497';

describe('isExpired', () => {
  it('never expires a rolling listing', () => {
    expect(isExpired(null, Date.parse('2099-01-01T00:00:00Z'))).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });

  it('is open right up to the deadline', () => {
    expect(isExpired(deadline, Date.parse('2026-11-02T04:13:42Z'))).toBe(false);
  });

  it('closes at the deadline itself and stays closed after', () => {
    expect(isExpired(deadline, Date.parse('2026-11-02T04:13:43.497Z'))).toBe(true);
    expect(isExpired(deadline, Date.parse('2026-11-02T04:13:44Z'))).toBe(true);
  });
});

describe('openDeadlineFilter', () => {
  it('keeps rolling listings and deadlines strictly after now', () => {
    expect(openDeadlineFilter(new Date('2026-11-02T14:47:12.117Z')))
      .toBe('deadline.is.null,deadline.gt.2026-11-02T14:47:12.117Z');
  });
});
