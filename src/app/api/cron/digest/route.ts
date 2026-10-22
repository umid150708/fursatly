/**
 * GET /api/cron/digest
 *
 * Weekly "closing this week" roundup: one compact message to the Fursatly
 * channel listing the opportunities whose deadlines fall in the next 7 days,
 * soonest first. A weekly ritual on top of the daily per-opportunity posts —
 * drives urgency and gives followers a reason to check back.
 *
 * No LLM calls; formatting lives in src/lib/channel-post.ts (buildDigest).
 * Sent through ChannelSender (Premium user account, bot fallback).
 * Auth matches the other crons: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 * Preview without posting: ?dry=1.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildDigest, isPostable } from '@/lib/channel-post';
import { ChannelSender } from '@/lib/channel-sender';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CHANNEL   = process.env.TELEGRAM_CHANNEL || '@fursatly';
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // deadlines within the next week
const MAX_ITEMS = 8;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const isVercelCron = request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
  const isManual     = searchParams.get('secret') === CRON_SECRET;
  if (!isVercelCron && !isManual) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dry = searchParams.get('dry') === '1';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });

  const now = Date.now();
  const supabase = db();
  const { data: events } = await supabase
    .from('events')
    .select('id,title,source,deadline,research_data')
    .eq('is_active', true)
    .not('deadline', 'is', null)
    .order('deadline', { ascending: true })
    .limit(200);

  const closing = (events ?? [])
    .filter(isPostable)
    .filter((e) => {
      const t = new Date(e.deadline).getTime();
      return !isNaN(t) && t >= now && t <= now + WINDOW_MS;
    })
    .slice(0, MAX_ITEMS);

  if (closing.length === 0) {
    return NextResponse.json({ ok: true, posted: 0, reason: 'nothing closing this week' });
  }

  const text = buildDigest(closing);
  if (dry) {
    return NextResponse.json({ ok: true, dry: true, channel: CHANNEL, count: closing.length, text });
  }

  const sender = new ChannelSender(CHANNEL);
  const sent = await sender.send(text);
  await sender.close();
  if (!sent.ok) {
    return NextResponse.json({ ok: false, error: sent.error }, { status: 502 });
  }
  console.log(`[Digest] posted ${closing.length} closing-soon items to ${CHANNEL}`);
  return NextResponse.json({ ok: true, posted: closing.length, channel: CHANNEL, via: sent.via });
}
