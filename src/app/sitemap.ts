import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { eventSlug } from '@/lib/event-path';

/**
 * Sitemap for crawlers: homepage + every active event at its canonical slug
 * URL. Expired events are hard-deleted by the cleanup cron, so regenerating
 * hourly keeps the sitemap free of 404s without hammering the database.
 */
export const revalidate = 3600;

const BASE = 'https://fursatly.uz';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home = { url: BASE, changeFrequency: 'daily' as const, priority: 1 };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase
      .from('events')
      .select('id, created_at, research_completed_at, research_data')
      .eq('is_active', true)
      .limit(2000);

    const events = (data ?? []).map((ev) => ({
      url: `${BASE}/event/${eventSlug(ev)}`,
      lastModified: new Date(ev.research_completed_at || ev.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    return [home, ...events];
  } catch {
    return [home]; // partial sitemap beats a 500 for crawlers
  }
}
