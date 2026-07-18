/**
 * GET /api/cron/reminders
 *
 * Telegram-DM deadline reminders for saved opportunities: '3d' when the
 * deadline is within 3 days, '1d' within 1 day. The reminders_sent ledger
 * (unique per saved-opp × window) makes re-runs idempotent.
 *
 * Only reaches users who linked Telegram (profiles.telegram_chat_id) and
 * kept reminders_enabled on. One blocked bot must not sink the batch —
 * every send is individually caught.
 *
 * Auth matches the other crons: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 * Preview without sending: ?dry=1.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { selectDueReminders, sentKey, type ReminderCandidate } from '@/lib/reminder-logic';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SITE = 'https://fursatly.uz';
const GAP_MS = 1_500; // between DMs — same Telegram-rate-limit spacing as broadcast
const MAX_SENDS = 30; // stay well inside maxDuration; the ledger carries the rest over

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Bilingual (UZ + EN) reminder — matches the channel's trilingual habit, kept short for a DM. */
function buildMessage(ev: any, daysLeft: number): string {
  const uzTitle = ev.research_data?.translations?.uz?.title;
  const title = esc(uzTitle || ev.title);
  const deadline = fmtDate(new Date(ev.deadline));
  const dayWord =
    daysLeft === 1 ? '1 kun qoldi / 1 day left' : `${daysLeft} kun qoldi / ${daysLeft} days left`;
  return [
    `⏰ <b>Eslatma / Reminder</b>`,
    ``,
    `<b>${title}</b>`,
    ``,
    `📅 Deadline: <b>${deadline}</b> — ${dayWord}`,
    `🔗 ${SITE}/event/${ev.id}`,
  ].join('\n');
}

async function sendDm(botToken: string, chatId: number, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`telegram ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const isVercelCron    = request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
  const isManualTrigger = searchParams.get('secret') === CRON_SECRET;
  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  const dry = searchParams.get('dry') === '1';
  const supabase = db();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 3 * 86_400_000);

  // ── 1. Saved opps with in-window deadlines, joined to reminder-ready profiles ──
  const { data: rows, error } = await supabase
    .from('saved_opportunities')
    .select(
      `id, user_id,
       events!inner(id, title, deadline, research_data),
       profiles!inner(telegram_chat_id, reminders_enabled)`,
    )
    .gt('events.deadline', now.toISOString())
    .lte('events.deadline', windowEnd.toISOString())
    .eq('profiles.reminders_enabled', true)
    .not('profiles.telegram_chat_id', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ due: 0, sent: 0, skipped: 0 });
  }

  // ── 2. What's already been sent for these saved-opps ──────────────────
  const savedIds = rows.map((r) => r.id);
  const { data: sentRows, error: sentErr } = await supabase
    .from('reminders_sent')
    .select('saved_opportunity_id, offset_label')
    .in('saved_opportunity_id', savedIds);
  if (sentErr) {
    return NextResponse.json({ error: sentErr.message }, { status: 500 });
  }
  const sent = new Set(
    (sentRows ?? []).map((r) => sentKey(r.saved_opportunity_id, r.offset_label)),
  );

  // ── 3. Pure selection ─────────────────────────────────────────────────
  const byId = new Map(rows.map((r) => [r.id, r]));
  const candidates: ReminderCandidate[] = rows.map((r) => ({
    savedId: r.id,
    deadline: new Date((r.events as any).deadline),
  }));
  const due = selectDueReminders(candidates, sent, now).slice(0, MAX_SENDS);

  if (dry) {
    return NextResponse.json({
      due: due.length,
      preview: due.map((d) => {
        const row = byId.get(d.savedId)!;
        return { label: d.label, chat: (row.profiles as any).telegram_chat_id, text: buildMessage(row.events, d.daysLeft) };
      }),
    });
  }

  // ── 4. Send + record, isolating per-user failures ─────────────────────
  let sentCount = 0;
  let failCount = 0;
  for (const d of due) {
    const row = byId.get(d.savedId)!;
    try {
      await sendDm(botToken, (row.profiles as any).telegram_chat_id, buildMessage(row.events, d.daysLeft));
      await supabase
        .from('reminders_sent')
        .insert({ saved_opportunity_id: d.savedId, offset_label: d.label });
      sentCount++;
    } catch (e) {
      failCount++;
      console.error(`[Reminders] send failed for saved=${d.savedId}:`, e instanceof Error ? e.message : e);
    }
    if (due.indexOf(d) < due.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }

  return NextResponse.json({ due: due.length, sent: sentCount, failed: failCount });
}
