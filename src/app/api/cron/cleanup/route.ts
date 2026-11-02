/**
 * GET /api/cron/cleanup
 *
 * Deletes every event whose deadline has passed, active or not.
 * Runs daily at 03:00 UTC via Vercel cron. The per-minute pg_cron job in
 * supabase/migrations/20261102120000_expire_events_every_minute.sql does the
 * exact-time deletes; this run is the backstop.
 *
 * Deadline is a zone-less UTC timestamp, so it compares correctly with the ISO
 * "now" below.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Hobby max timeout (single DELETE query — runs in well under a second).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
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

  const supabase = db();
  const now = new Date().toISOString();

  // Hard-delete every event whose deadline has passed (active or not)
  const { data, error } = await supabase
    .from('events')
    .delete()
    .not('deadline', 'is', null)
    .lte('deadline', now)
    .select('id, title');

  if (error) {
    console.error('[Cleanup] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  console.log(`[Cleanup] Deleted ${count} expired events`);
  return NextResponse.json({ ok: true, deleted: count });
}
