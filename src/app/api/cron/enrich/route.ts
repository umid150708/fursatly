/**
 * GET /api/cron/enrich
 *
 * Picks up un-enriched events and runs them through the AI pipeline.
 * Called by cron-job.org every 5 minutes.
 *
 * Works with the CURRENT database schema — no migration required.
 *
 * Queue signal: is_active = false AND research_data IS NULL
 *   → these are newly ingested events waiting for enrichment
 *
 * After enrichment: is_active = true, research_data = { ...enriched data }
 *
 * Retry handling (without retry_count column):
 *   - Events that failed enrichment stay at is_active=false, research_data=NULL
 *   - They are picked up again on the next cycle automatically
 *   - To prevent infinite retries on truly broken events, we limit to 3 attempts
 *     by storing attempt count inside research_data: { _attempts: N }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enrichEvent } from '@/pipeline/enrich';

const MAX_PER_CYCLE = 10;
const MAX_ATTEMPTS  = 3;

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

  // Queue: all inactive events (either never enriched or failed)
  // Application-level check filters out events that exhausted retries
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, research_data')
    .eq('is_active', false)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_CYCLE * 3); // fetch extra to account for exhausted ones we'll skip

  if (error) {
    console.error('[Enrich] DB fetch error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!events?.length) {
    return NextResponse.json({ ok: true, enriched: 0, failed: 0, message: 'Queue empty' });
  }

  const results: Array<{ id: string; title: string; status: string; error?: string }> = [];
  let processed = 0;

  for (const event of events) {
    if (processed >= MAX_PER_CYCLE) break;

    // Skip permanently-failed events (exhausted retries)
    const rd = event.research_data as any;
    const attempts = rd?._attempts ?? 0;
    const alreadyActive = rd && !rd._failed && !rd._skipped; // has real enriched data

    if (alreadyActive) continue;   // was active before, skip (shouldn't be in queue)
    if (attempts >= MAX_ATTEMPTS) {
      console.log(`[Enrich] Skipping ${event.id} — exhausted ${MAX_ATTEMPTS} attempts`);
      results.push({ id: event.id, title: event.title, status: 'exhausted' });
      continue;
    }

    processed++;

    try {
      await enrichEvent(event.id);
      results.push({ id: event.id, title: event.title, status: 'enriched' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Enrich] Failed ${event.id}:`, message);

      // Record failure in research_data so we can track retry attempts
      await supabase
        .from('events')
        .update({
          research_data: {
            _failed:   true,
            _attempts: attempts + 1,
            _error:    message,
            _failedAt: new Date().toISOString(),
          },
        })
        .eq('id', event.id);

      results.push({ id: event.id, title: event.title, status: 'failed', error: message });
    }
  }

  const enriched = results.filter(r => r.status === 'enriched').length;
  const failed   = results.filter(r => r.status === 'failed').length;

  console.log(`[Enrich] Cycle: ${enriched} enriched, ${failed} failed`);
  return NextResponse.json({ ok: true, enriched, failed, events: results });
}
