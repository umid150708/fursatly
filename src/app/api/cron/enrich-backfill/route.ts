/**
 * GET /api/cron/enrich-backfill
 *
 * Daily deep re-enrichment: finds ACTIVE events whose research is thin
 * (few tips / eligibility / key details) and re-runs them through the ONE
 * enrichment pipeline (src/pipeline/enrich.ts) — the same Groq path as every
 * other enrich route. No separate implementation, no separate provider.
 *
 * Auth matches the sibling crons: Vercel's Bearer header or ?secret=<CRON_SECRET>.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enrichEvent } from '@/pipeline/enrich';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 3;   // ~3 Groq calls each; 3 in parallel fits Vercel's 60s cap

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function isThin(rd: any): boolean {
  return (rd?.competitionTips?.length     ?? 0) < 3
      || (rd?.eligibilityCriteria?.length ?? 0) < 3
      || (rd?.keyDetails?.length          ?? 0) < 3;
}

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const isVercelCron = request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
  const isManual     = searchParams.get('secret') === CRON_SECRET;
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = db();
  const { data: active } = await supabase
    .from('events')
    .select('id, research_data')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(60);

  const thin = (active ?? []).filter(e => isThin(e.research_data)).slice(0, BATCH_SIZE);
  if (!thin.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Nothing thin to re-enrich' });
  }

  const results = await Promise.allSettled(thin.map(e => enrichEvent(e.id)));
  const ok = results.filter(r => r.status === 'fulfilled').length;

  console.log(`[Enrich-Backfill] ${ok}/${thin.length} re-enriched`);
  return NextResponse.json({ ok: true, processed: ok, failed: thin.length - ok });
}
