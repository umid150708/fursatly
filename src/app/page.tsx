import { createClient } from '@supabase/supabase-js';
import HomeClient from './HomeClient';
import { EVENT_LIST_SELECT, mapEventListRow } from '@/lib/event-list';

/**
 * Server half of the homepage. Fetches the trimmed events list at build/ISR
 * time so the HTML ships with real cards — no client-side fetch spinner on
 * first paint. Revalidates every 5 minutes, matching the client poll cadence
 * and the enrichment cron's write rhythm.
 *
 * Public data only (anon key, RLS-readable) — no cookies touched, so the page
 * stays fully static/ISR-cacheable. If the fetch fails we pass null and the
 * client falls back to fetching exactly as it did before this optimisation.
 */
export const revalidate = 300;

async function fetchInitialEvents(): Promise<any[] | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
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

export default async function Page() {
  const initialEvents = await fetchInitialEvents();
  return <HomeClient initialEvents={initialEvents} />;
}
