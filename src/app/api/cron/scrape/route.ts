/**
 * GET /api/cron/scrape
 *
 * Scrapes the last 24 h of posts from all Telegram channels.
 * Runs daily at 02:00 UTC via Vercel cron.
 *
 * Features:
 *  - Paginates using ?before={msgId} until posts older than 24 h are reached
 *  - Extracts <a href> URLs from each message so apply links survive the
 *    text-only extraction step (appended as plain text to the post body)
 *  - Dedup + AI extraction handled by ingestEventFromText
 *  - Respects Groq rate limits via the shared callLLM wrapper
 */

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { ingestEventFromText } from '@/services/event-ingestion';

// Vercel Hobby has a 60s hard timeout on serverless functions.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALL_CHANNELS        = ['edugrandsuz', 'grantlar', 'Volunteensuz'];
const MAX_PAGES           = 2;     // 2 pages per channel — plenty for a 24h window
const MIN_TEXT_LENGTH     = 80;    // ignore very short posts
const CUTOFF_MS           = 25 * 60 * 60 * 1000; // 25 h overlap so we never miss a post
const MAX_POSTS_PER_RUN   = 6;     // total across all channels — keeps AI cost inside the 60s window

// ── HTML helpers ──────────────────────────────────────────────────────────────

interface ParsedMessage {
  msgId:  number;
  date:   Date;
  text:   string;   // plain text + appended hrefs so URL regex in extraction finds them
}

function parseMessages(html: string): ParsedMessage[] {
  const $ = cheerio.load(html);
  const out: ParsedMessage[] = [];

  $('.tgme_widget_message').each((_, el) => {
    const postAttr = $(el).attr('data-post') ?? '';
    const msgId    = parseInt(postAttr.split('/')[1] ?? '0', 10);
    const datetime = $(el).find('time').attr('datetime') ?? '';
    const textEl   = $(el).find('.tgme_widget_message_text');

    textEl.find('br').replaceWith('\n');
    const text = textEl.text().trim();

    // Extract <a href> URLs from the message so apply links are preserved
    const hrefs: string[] = [];
    textEl.find('a[href]').each((_, a) => {
      const href = $(a).attr('href') ?? '';
      // Skip Telegram channel links and internal tg:// links
      if (href && !href.startsWith('tg://') && !href.match(/t\.me\/s\//)) {
        hrefs.push(href);
      }
    });

    const fullText = hrefs.length
      ? `${text}\n\n${hrefs.join('\n')}`
      : text;

    if (msgId && datetime && fullText.length >= MIN_TEXT_LENGTH) {
      out.push({ msgId, date: new Date(datetime), text: fullText });
    }
  });

  return out;
}

async function fetchPage(channel: string, beforeId?: number): Promise<string> {
  const url = beforeId
    ? `https://t.me/s/${channel}?before=${beforeId}`
    : `https://t.me/s/${channel}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fursatly/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${channel}`);
  return res.text();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);

  const isVercelCron    = request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
  const isManualTrigger = CRON_SECRET && searchParams.get('secret') === CRON_SECRET;

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - CUTOFF_MS);
  const results: Array<{ channel: string; status: string; title?: string; error?: string }> = [];

  // Track total ingest count across channels so we don't exceed our budget.
  let totalIngested = 0;

  for (const channel of ALL_CHANNELS) {
    if (totalIngested >= MAX_POSTS_PER_RUN) {
      console.log(`[Scraper] Budget exhausted — skipping ${channel}`);
      break;
    }
    console.log(`[Scraper] Channel: ${channel}`);

    // ── Paginate until we've covered the last 24 h ──────────────────────────
    const collected: ParsedMessage[] = [];
    let beforeId: number | undefined;
    let pages = 0;

    try {
      while (pages < MAX_PAGES) {
        const html = await fetchPage(channel, beforeId);
        const msgs = parseMessages(html);
        if (!msgs.length) break;

        pages++;
        const inWindow = msgs.filter(m => m.date >= cutoff);
        collected.push(...inWindow);

        const oldest = msgs.reduce((a, b) => (a.date < b.date ? a : b));
        if (oldest.date < cutoff) break;           // reached 24 h boundary

        beforeId = Math.min(...msgs.map(m => m.msgId));  // paginate further back
        await new Promise(r => setTimeout(r, 600));       // polite pause between pages
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Scraper] Fetch failed ${channel}:`, msg);
      results.push({ channel, status: 'fetch_error', error: msg });
      continue;
    }

    // Deduplicate by text prefix before hitting AI
    const unique = collected.filter(
      (p, i, arr) => arr.findIndex(q => q.text.slice(0, 100) === p.text.slice(0, 100)) === i
    );

    console.log(`[Scraper] ${channel}: ${unique.length} unique posts from last 24 h`);

    // ── Ingest each post ────────────────────────────────────────────────────
    // Stop ingesting once we hit the per-run budget; remaining posts get
    // picked up on the next cron tick.
    for (const post of unique) {
      if (totalIngested >= MAX_POSTS_PER_RUN) break;
      try {
        const eventId = await ingestEventFromText(post.text);
        results.push({
          channel,
          status: eventId ? 'inserted' : 'skipped',
        });
        totalIngested++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Scraper] Ingest error on ${channel}:`, msg);
        results.push({ channel, status: 'error', error: msg });
      }
    }
  }

  const inserted = results.filter(r => r.status === 'inserted').length;
  const skipped  = results.filter(r => r.status === 'skipped').length;
  const errors   = results.filter(r => r.status === 'error').length;

  console.log(`[Scraper] Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);

  return NextResponse.json({ ok: true, inserted, skipped, errors, details: results });
}
