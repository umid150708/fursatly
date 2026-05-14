import { NextResponse } from 'next/server';
import { enrichPendingEvents } from '@/services/event-enrichment';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const isVercelCron = request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
  const isManual = searchParams.get('secret') === CRON_SECRET;

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await enrichPendingEvents();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Enrich Backfill] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
