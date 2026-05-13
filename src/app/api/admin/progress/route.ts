/**
 * GET /api/admin/progress
 *
 * Returns a real-time snapshot of the Fursatly pipeline:
 *   - Total active events
 *   - Events added in the last 7 days
 *   - Enrichment queue size (waiting to be processed)
 *   - Failed events (exhausted retries)
 *   - Skipped events (quality gate failed)
 *   - Breakdown by category (source column)
 *   - Recent events list
 *
 * Protected by the same CRON_SECRET used elsewhere.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Run all queries in parallel
  const [
    activeRes,
    recentRes,
    queueRes,
    allInactiveRes,
    categoryRes,
  ] = await Promise.all([
    // Total active events
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Events added in last 7 days (active or not)
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    // Enrichment queue: inactive + no research_data (never processed)
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', false)
      .is('research_data', null),

    // All inactive events with research_data (failed, skipped, or exhausted)
    supabase
      .from('events')
      .select('id, research_data')
      .eq('is_active', false)
      .not('research_data', 'is', null),

    // Category breakdown of active events
    supabase
      .from('events')
      .select('source')
      .eq('is_active', true),
  ]);

  // Classify failed / skipped / exhausted from inactive+research_data
  const inactiveWithData = allInactiveRes.data ?? [];
  let failed    = 0;
  let skipped   = 0;
  let exhausted = 0;
  let retrying  = 0;

  for (const ev of inactiveWithData) {
    const rd = ev.research_data as any;
    if (!rd) continue;
    if (rd._skipped) { skipped++; continue; }
    const attempts = rd._attempts ?? 0;
    if (attempts >= 3) { exhausted++; continue; }
    if (rd._failed)   { retrying++; continue; }
  }

  // Category breakdown
  const catMap: Record<string, number> = {};
  for (const ev of (categoryRes.data ?? [])) {
    const cat = ev.source ?? 'Unknown';
    catMap[cat] = (catMap[cat] ?? 0) + 1;
  }
  const byCategory = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));

  // Recent 10 active events
  const { data: recentEvents } = await supabase
    .from('events')
    .select('id, title, source, created_at, deadline, language')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  const payload = {
    ok: true,
    asOf: new Date().toISOString(),
    summary: {
      activeEvents:      activeRes.count  ?? 0,
      addedLast7Days:    recentRes.count  ?? 0,
      enrichmentQueue:   queueRes.count   ?? 0,   // waiting for AI processing
      retrying,                                    // failed but will retry
      skipped,                                     // quality gate rejected
      exhausted,                                   // 3 attempts, gave up
    },
    byCategory,
    recentEvents: (recentEvents ?? []).map(e => ({
      id:        e.id,
      title:     e.title,
      category:  e.source,
      language:  e.language,
      deadline:  e.deadline,
      createdAt: e.created_at,
    })),
  };

  return NextResponse.json(payload);
}
