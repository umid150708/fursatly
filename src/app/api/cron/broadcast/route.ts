/**
 * GET /api/cron/broadcast
 *
 * Outbound Telegram broadcaster: posts up to 5 curated opportunities per run to
 * the Fursatly channel as individual, trilingual (UZ / RU / EN) styled posts,
 * assembled from the already-enriched + translated DB fields (no LLM calls).
 *
 * Prioritises soonest-deadline (still-open) opportunities and never reposts —
 * a `research_data.postedToTelegramAt` stamp marks what's already gone out.
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

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CHANNEL   = process.env.TELEGRAM_CHANNEL || '@fursatly';
const SITE      = 'https://fursatly.uz';
const MAX_POSTS = 5;
const GAP_MS    = 1_500; // between posts, to stay within Telegram rate limits

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const CATEGORY: Record<string, { emoji: string; uz: string; ru: string; en: string; tag: string }> = {
  Scholarships:      { emoji: '🎓', uz: 'GRANT',        ru: 'ГРАНТ',           en: 'SCHOLARSHIP',   tag: 'Scholarship' },
  Competitions:      { emoji: '🏆', uz: 'MUSOBAQA',     ru: 'КОНКУРС',         en: 'COMPETITION',   tag: 'Competition' },
  'Summer Programs': { emoji: '☀️', uz: 'YOZGI DASTUR', ru: 'ЛЕТНЯЯ ПРОГРАММА', en: 'SUMMER PROGRAM', tag: 'SummerProgram' },
  Research:          { emoji: '🔬', uz: 'TADQIQOT',     ru: 'ИССЛЕДОВАНИЕ',    en: 'RESEARCH',      tag: 'Research' },
  Volunteer:         { emoji: '🤝', uz: 'VOLONTYORLIK', ru: 'ВОЛОНТЁРСТВО',    en: 'VOLUNTEER',     tag: 'Volunteer' },
  STEM:              { emoji: '💻', uz: 'STEM',         ru: 'STEM',            en: 'STEM',          tag: 'STEM' },
  Internships:       { emoji: '💼', uz: 'STAJIROVKA',   ru: 'СТАЖИРОВКА',      en: 'INTERNSHIP',    tag: 'Internship' },
  Workshops:         { emoji: '📚', uz: 'SEMINAR',      ru: 'СЕМИНАР',         en: 'WORKSHOP',      tag: 'Workshop' },
  Fellowships:       { emoji: '🌍', uz: 'STIPENDIYA',   ru: 'СТИПЕНДИЯ',       en: 'FELLOWSHIP',    tag: 'Fellowship' },
  Other:             { emoji: '✨', uz: 'IMKONIYAT',    ru: 'ВОЗМОЖНОСТЬ',     en: 'OPPORTUNITY',   tag: 'Opportunity' },
};

const escText = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const trim = (s = '', n = 200) => {
  const t = s.trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

const fmtDate = (d: string | null) => {
  if (!d) return 'Rolling';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Rolling';
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

function applyUrl(ev: any): string | null {
  const rd = ev.research_data || {};
  if (typeof rd.officialWebsite === 'string' && /^https?:\/\//.test(rd.officialWebsite)) return rd.officialWebsite;
  const m = (ev.description || '').match(/https?:\/\/[^\s)\]]+/);
  return m ? m[0] : null;
}

function buildPost(ev: any): string {
  const rd = ev.research_data || {};
  const cat = CATEGORY[ev.source] || CATEGORY.Other;
  const uz = rd.translations?.uz || {};
  const ru = rd.translations?.ru || {};

  const L: string[] = [];
  L.push(`${cat.emoji} <b>${cat.uz} / ${cat.ru} / ${cat.en}</b>`);
  L.push('');
  L.push(`🇺🇿 <b>${escText(uz.title || ev.title)}</b>`);
  const dUz = trim(uz.extendedDescription || rd.extendedDescription || '');
  if (dUz) L.push(escText(dUz));
  L.push('');
  L.push(`🇷🇺 <b>${escText(ru.title || ev.title)}</b>`);
  const dRu = trim(ru.extendedDescription || rd.extendedDescription || '');
  if (dRu) L.push(escText(dRu));
  L.push('');
  L.push(`🇬🇧 <b>${escText(ev.title)}</b>`);
  const dEn = trim(rd.extendedDescription || '');
  if (dEn) L.push(escText(dEn));
  L.push('');
  // Meta line mirrors the website card (location · age · language).
  const meta: string[] = [];
  if (ev.location) meta.push(`📍 ${escText(ev.location)}`);
  if (!(ev.age_min === 0 && ev.age_max === 100)) meta.push(`👤 ${ev.age_min}–${ev.age_max}`);
  if (ev.language) meta.push(`🗣 ${escText(ev.language)}`);
  if (meta.length) L.push(meta.join('  ·  '));
  L.push(`⏳ Muddat / Дедлайн / Deadline: <b>${fmtDate(ev.deadline)}</b>`);
  if (rd.funding_type === 'Full') L.push(`✅ To'liq moliyalashtirilgan / Полное финансирование / Fully funded`);
  L.push('');
  const url = applyUrl(ev);
  if (url) L.push(`🔗 <a href="${escAttr(url)}">Ariza / Заявка / Apply</a>`);
  L.push(`👉 <a href="${SITE}/event/${ev.id}">Batafsil / Подробнее / Details</a>`);
  L.push('');
  L.push(`#${cat.tag} #Fursatly #imkoniyat`);
  return L.join('\n');
}

async function sendPost(token: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHANNEL, text, parse_mode: 'HTML', disable_web_page_preview: true }),
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
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;         // soonest deadline first
      const dbb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - dbb;
    })
    .slice(0, limit);

  if (dry) {
    return NextResponse.json({
      ok: true, dry: true, channel: CHANNEL, count: candidates.length,
      posts: candidates.map((e) => ({ id: e.id, title: e.title, text: buildPost(e) })),
    });
  }

  const results: any[] = [];
  for (const ev of candidates) {
    const sent = await sendPost(token!, buildPost(ev));
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
