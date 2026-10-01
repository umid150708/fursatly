import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import HomeClient, { type LeadDetail } from './HomeClient';
import { EVENT_LIST_SELECT, mapEventListRow } from '@/lib/event-list';
import { pickLead } from '@/lib/front-page';
import { siteJsonLd, jsonLdScript } from '@/lib/site-schema';

/**
 * Server half of the homepage. Fetches the trimmed events list at build/ISR
 * time so the HTML ships with real stories — no client-side fetch spinner on
 * first paint. Revalidates every 5 minutes, matching the client poll cadence
 * and the enrichment cron's write rhythm.
 *
 * It also picks the lead story (the same pure rule the client uses, at the
 * same reference time) and fetches just that one story's researched summary in
 * all three languages — the list itself stays trimmed.
 *
 * Public data only (anon key, RLS-readable) — no cookies touched, so the page
 * stays fully static/ISR-cacheable. If a fetch fails we pass null and the
 * client falls back exactly as it did before.
 */
export const revalidate = 300;

// The homepage's one address. Without it the www host and stray query strings
// (?utm_…, ?ref=…) read to Google as separate copies of the front page.
export const metadata: Metadata = { alternates: { canonical: '/' } };

const siteSchema = jsonLdScript(siteJsonLd());

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

type Db = ReturnType<typeof db>;

async function fetchInitialEvents(supabase: Db): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_LIST_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error || !data || data.length === 0) return null;
    return data.map(mapEventListRow);
  } catch {
    return null; // client-side fetch takes over
  }
}

async function fetchLeadDetail(supabase: Db, id: string): Promise<LeadDetail | null> {
  try {
    const { data } = await supabase
      .from('events')
      .select(
        'id,' +
        'en:research_data->>extendedDescription,' +
        'uz:research_data->translations->uz->>extendedDescription,' +
        'ru:research_data->translations->ru->>extendedDescription',
      )
      .eq('id', id)
      .single();
    return (data as unknown as LeadDetail) ?? null;
  } catch {
    return null; // the lead still runs, just without its summary
  }
}

export default async function Page() {
  const renderedAt = Date.now();
  let supabase: Db;
  try {
    supabase = db();
  } catch {
    // No client (missing env): ship the page empty and let the client fetch.
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteSchema }} />
        <HomeClient initialEvents={null} renderedAt={renderedAt} leadDetail={null} />
      </>
    );
  }
  const initialEvents = await fetchInitialEvents(supabase);
  const lead = initialEvents ? pickLead(initialEvents, renderedAt) : null;
  const leadDetail = lead ? await fetchLeadDetail(supabase, lead.id) : null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteSchema }} />
      <HomeClient initialEvents={initialEvents} renderedAt={renderedAt} leadDetail={leadDetail} />
    </>
  );
}
