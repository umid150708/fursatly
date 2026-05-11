/**
 * GET /api/cron/cleanup
 *
 * Deletes events whose deadlines have passed.
 * Runs daily at 03:00 UTC via Vercel cron.
 *
 * Works with existing schema — deadline is stored as text ISO string.
 * Supabase casts it for comparison automatically.
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
  const CRON_SECRET = process.env.CRON_SECRET ?? 'fursatly123';
  const { searchParams } = new URL(request.url);

  const isVercelCron    = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const isManualTrigger = searchParams.get('secret') === CRON_SECRET;

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = db();
  const now = new Date().toISOString();

  // Hard-delete events where deadline string (ISO) is in the past
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('is_active', true)
    .not('deadline', 'is', null)
    .lt('deadline', now)
    .select('id, title');

  if (error) {
    console.error('[Cleanup] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  console.log(`[Cleanup] Deleted ${count} expired events`);
  return NextResponse.json({ ok: true, deleted: count });
}
