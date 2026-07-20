/**
 * GET /api/cron/broadcast
 *
 * Outbound Telegram broadcaster: posts up to 5 curated opportunities per run to
 * the Fursatly channel as individual, trilingual (UZ / RU / EN) styled posts,
 * assembled from the already-enriched + translated DB fields (no LLM calls).
 * Post formatting lives in src/lib/channel-post.ts (unit-tested).
 *
 * Each post carries a large link preview of the event's fursatly.uz page, so
 * the channel card shows the branded OG image (category color, deadline).
 *
 * Prioritises soonest-deadline (still-open) opportunities and never reposts —
 * a `research_data.postedToTelegramAt` stamp marks what's already gone out.
 * Unenriched events are skipped until the enrich cron finishes them.
 *
 * Config:
 *   TELEGRAM_BOT_TOKEN  (required) — a bot that is ADMIN of the channel
 *   TELEGRAM_CHANNEL    (optional) — @handle or numeric id; default "@fursatly"
 *
 * Auth matches the other crons: Bearer <CRON_SECRET> header or ?secret=<CRON_SECRET>.
 * Preview without posting: ?dry=1 (returns the built post text, sends nothing).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildPost, isPostable, detailsUrl } from '@/lib/channel-post';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CHANNEL   = process.env.TELEGRAM_CHANNEL || '@fursatly';
const MAX_POSTS = 5;
const GAP_MS    = 1_500; // between posts, to stay within Telegram rate limits

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function sendPost(token: string, text: string, previewUrl: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHANNEL,
      text,
      parse_mode: 'HTML',
      // Show the event page's OG card as a large preview under the post.
      link_preview_options: { url: previewUrl, prefer_large_media: true },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body.description || `HTTP ${res.status}` };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const isVercelCron = request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
  const isManual     = searchParams.get('secret') === CRON_SECRET;
  if (!isVercelCron && !isManual) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dry   = searchParams.get('dry') === '1';
  const limit = Math.min(MAX_POSTS, Math.max(1, parseInt(searchParams.get('limit') || String(MAX_POSTS), 10) || MAX_POSTS));

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });

  const supabase = db();
  const { data: events } = await supabase
    .from('events')
    .select('id,title,description,location,deadline,source,research_data,created_at,age_min,age_max,language')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(80);

  const now = Date.now();
  const candidates = (events ?? [])
    .filter((e) => !e.research_data?.postedToTelegramAt)                         // not posted yet
    .filter((e) => !e.deadline || new Date(e.deadline).getTime() > now)          // still open
    .filter(isPostable)                                                          // enriched enough to look good
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;         // soonest deadline first
      const dbb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - dbb;
    })
    .slice(0, limit);

  if (dry) {
    return NextResponse.json({
      ok: true, dry: true, channel: CHANNEL, count: candidates.length,
      posts: candidates.map((e) => ({ id: e.id, title: e.title, preview: detailsUrl(e), text: buildPost(e) })),
    });
  }

  const results: any[] = [];
  for (const ev of candidates) {
    const sent = await sendPost(token!, buildPost(ev), detailsUrl(ev));
    if (sent.ok) {
      await supabase
        .from('events')
        .update({ research_data: { ...ev.research_data, postedToTelegramAt: new Date().toISOString() } })
        .eq('id', ev.id);
      results.push({ id: ev.id, title: ev.title, status: 'posted' });
    } else {
      results.push({ id: ev.id, title: ev.title, status: 'failed', error: sent.error });
    }
    await sleep(GAP_MS);
  }

  const posted = results.filter((r) => r.status === 'posted').length;
  console.log(`[Broadcast] posted ${posted}/${candidates.length} to ${CHANNEL}`);
  return NextResponse.json({ ok: true, channel: CHANNEL, posted, results });
}
