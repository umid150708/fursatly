/**
 * GET /api/cron/enrich
 *
 * Picks up un-enriched events AND events missing Russian translations,
 * then runs them through the AI pipeline.
 * Called by cron-job.org every 10 minutes.
 *
 * IMPORTANT: Vercel Hobby plan has a 60-second hard timeout on serverless
 * functions. We process a SMALL batch per call (2 events in parallel) so
 * a single invocation finishes well under the limit. The 10-min cron drains
 * the queue across many small invocations instead of one long one.
 *
 * Queue signal: is_active = false AND research_data IS NULL → fresh queue
 * Also enriches: active events missing translations.ru → translation backfill
 *
 * After enrichment: is_active = true, research_data = { ...enriched, translations }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enrichEvent } from '@/pipeline/enrich';

// Vercel: extend the serverless timeout to the Hobby-plan max (60s).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BATCH_SIZE   = 2;   // events processed in parallel per invocation
const MAX_ATTEMPTS = 3;

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

  // Priority 1: events still in queue (never enriched)
  const { data: queueEvents } = await supabase
    .from('events')
    .select('id, title, research_data')
    .eq('is_active', false)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE * 3);

  // Priority 2: active events missing Russian translations (backfill)
  const { data: activeMissingRu } = await supabase
    .from('events')
    .select('id, title, research_data')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const needsTranslation = (activeMissingRu ?? [])
    .filter(e => {
      const rd: any = e.research_data;
      return rd && !rd?.translations?.ru;
    })
    .slice(0, BATCH_SIZE);

  // Pick up to BATCH_SIZE candidates, prioritizing the queue
  const candidates: Array<{ id: string; title: string; research_data: any; kind: 'queue' | 'translate' }> = [];

  for (const e of queueEvents ?? []) {
    if (candidates.length >= BATCH_SIZE) break;
    const rd: any = e.research_data;
    const attempts = rd?._attempts ?? 0;
    if (attempts >= MAX_ATTEMPTS) continue;
    candidates.push({ ...e, kind: 'queue' });
  }
  for (const e of needsTranslation) {
    if (candidates.length >= BATCH_SIZE) break;
    candidates.push({ ...e, kind: 'translate' });
  }

  if (!candidates.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Nothing to do' });
  }

  // Process in PARALLEL so the cron finishes inside Vercel's 60s window
  const results = await Promise.allSettled(
    candidates.map(async (event) => {
      try {
        await enrichEvent(event.id);
        return { id: event.id, title: event.title, kind: event.kind, status: 'ok' };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (event.kind === 'queue') {
          const rd: any = event.research_data;
          const attempts = (rd?._attempts ?? 0) + 1;
          await supabase
            .from('events')
            .update({
              research_data: {
                _failed:   true,
                _attempts: attempts,
                _error:    message,
                _failedAt: new Date().toISOString(),
              },
            })
            .eq('id', event.id);
        }
        return { id: event.id, title: event.title, kind: event.kind, status: 'failed', error: message };
      }
    }),
  );

  const flat = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'rejected' });
  const ok     = flat.filter((r: any) => r.status === 'ok').length;
  const failed = flat.filter((r: any) => r.status === 'failed' || r.status === 'rejected').length;

  console.log(`[Enrich] ${ok} ok, ${failed} failed`);
  return NextResponse.json({ ok: true, processed: ok, failed, results: flat });
}
