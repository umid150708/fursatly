/**
 * Front-page selection for the Gazette home page: the lead story, the
 * "Closing this week" column, the "In brief" column and the deadline forecast.
 *
 * Pure functions of (events, reference time). The server page calls pickLead
 * with the time it rendered at, to fetch that one story's full summary, and the
 * client renders with the same time until it has its own clock — so both pick
 * the same lead and hydration agrees.
 */

import { deadlineMs } from './dates';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

interface FrontEvent {
  id: string;
  deadline?: string | null;
  research_data?: { funding_type?: string | null } | null;
}

const due = (e: FrontEvent) => deadlineMs(e.deadline);
const byDeadline = (a: FrontEvent, b: FrontEvent) => due(a) - due(b);
const isFull = (e: FrontEvent) => e.research_data?.funding_type === 'Full';

/** Listings whose deadline is still ahead, soonest first. */
function upcoming<T extends FrontEvent>(events: T[], now: number): T[] {
  return events.filter((e) => due(e) > now).sort(byDeadline);
}

/**
 * The lead: the soonest fully funded deadline that is more than a week away
 * (so it does not repeat "Closing this week"), else the soonest fully funded
 * one, else the soonest deadline of any kind, else a rolling listing.
 */
export function pickLead<T extends FrontEvent>(events: T[], now: number): T | null {
  const ahead = upcoming(events, now);
  const funded = ahead.filter(isFull);
  return (
    funded.find((e) => due(e) > now + WEEK) ??
    funded[0] ??
    ahead[0] ??
    events.find((e) => !e.deadline) ??
    null
  );
}

/** Deadlines inside the next seven days, soonest first. */
export function closingThisWeek<T extends FrontEvent>(events: T[], now: number, limit = 7): T[] {
  return upcoming(events, now).filter((e) => due(e) < now + WEEK).slice(0, limit);
}

/**
 * Short items for the right-hand column: the next fully funded deadlines not
 * already on the page, topped up with any other upcoming ones.
 */
export function inBrief<T extends FrontEvent>(events: T[], now: number, exclude: Set<string>, limit = 4): T[] {
  const pool = upcoming(events, now).filter((e) => !exclude.has(e.id));
  return [...pool.filter(isFull), ...pool.filter((e) => !isFull(e))].slice(0, limit);
}

export interface Forecast {
  thisWeek: number;
  nextWeek: number;
  later: number;
  rolling: number;
}

/** Every open listing counted once: by how soon it closes, or as rolling. */
export function deadlineForecast(events: FrontEvent[], now: number): Forecast {
  const out: Forecast = { thisWeek: 0, nextWeek: 0, later: 0, rolling: 0 };
  for (const e of events) {
    if (!e.deadline) { out.rolling++; continue; }
    const left = due(e) - now;
    if (!(left > 0)) continue;
    if (left < WEEK) out.thisWeek++;
    else if (left < 2 * WEEK) out.nextWeek++;
    else out.later++;
  }
  return out;
}
