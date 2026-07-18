/**
 * Deadline-reminder selection — pure logic, no DB or network.
 *
 * A saved opportunity earns a reminder when its deadline is within the next
 * 3 days ('3d') or 1 day ('1d'). The reminders_sent ledger dedupes; if a user
 * saves something 12h before the deadline they get only the '1d' ping.
 */

export type OffsetLabel = '3d' | '1d';

export interface ReminderCandidate {
  savedId: string;
  deadline: Date;
}

export interface DueReminder {
  savedId: string;
  label: OffsetLabel;
  daysLeft: number;
}

/** Which reminder window (if any) a deadline falls in right now. */
export function dueLabel(deadline: Date, now: Date): OffsetLabel | null {
  const days = (deadline.getTime() - now.getTime()) / 86_400_000;
  if (days <= 0) return null; // already passed
  if (days <= 1) return '1d';
  if (days <= 3) return '3d';
  return null;
}

/** Ledger key, mirrors the unique(saved_opportunity_id, offset_label) constraint. */
export const sentKey = (savedId: string, label: OffsetLabel) => `${savedId}:${label}`;

/**
 * Filters candidates down to reminders that should be sent right now:
 * in-window, not already sent for that window.
 */
export function selectDueReminders(
  candidates: ReminderCandidate[],
  sent: ReadonlySet<string>,
  now: Date,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const c of candidates) {
    const label = dueLabel(c.deadline, now);
    if (!label) continue;
    if (sent.has(sentKey(c.savedId, label))) continue;
    const daysLeft = Math.max(1, Math.ceil((c.deadline.getTime() - now.getTime()) / 86_400_000));
    due.push({ savedId: c.savedId, label, daysLeft });
  }
  return due;
}
