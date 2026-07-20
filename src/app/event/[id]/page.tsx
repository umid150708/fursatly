import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchEventByParam } from '@/lib/event-server';
import { metaTitle, metaDescription } from '@/lib/event-meta';
import { isUuid } from '@/lib/event-path';
import EventClient from './EventClient';

/**
 * Server half of the event page. Fetches the row at ISR time so crawlers get
 * real HTML plus per-event metadata — the client half keeps all interactivity
 * (locale switching, save, mentor). Legacy UUID links 308 to the slug URL so
 * search engines consolidate onto one canonical address.
 */
export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { event } = await fetchEventByParam(id);
  if (!event) return { title: 'Opportunity — Fursatly' };

  const path = `/event/${event.research_data?.slug || event.id}`;
  const title = metaTitle(event);
  const description = metaDescription(event);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: 'Fursatly', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const { event, failed } = await fetchEventByParam(id);

  if (event) {
    const slug = event.research_data?.slug;
    if (isUuid(id) && slug) permanentRedirect(`/event/${slug}`);
    return <EventClient initialEvent={event} />;
  }

  // Transient DB error — let the client-side fetch retry instead of 404ing
  // an event that probably exists.
  if (failed) return <EventClient initialEvent={null} />;

  notFound();
}
