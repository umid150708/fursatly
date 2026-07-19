/**
 * One-off: give every existing event a slug in research_data.slug.
 * Idempotent — rows that already have a slug are left alone, and re-runs are
 * safe. Uniqueness is resolved in-memory across the whole set.
 *
 *   node scripts/backfill-slugs.mjs            # apply
 *   node scripts/backfill-slugs.mjs --dry      # preview only
 */
import { slugify, ensureUniqueSlug } from '../src/lib/slug.ts';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry');
if (!SUPA || !SRK) throw new Error('Missing Supabase env');

const rest = (path, opts = {}) =>
  fetch(`${SUPA}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });

const rows = await (await rest('events?select=id,title,research_data&order=created_at.asc')).json();
console.log(`events: ${rows.length}${DRY ? '  (dry run)' : ''}`);

const taken = new Set(rows.map((r) => r.research_data?.slug).filter(Boolean));
let created = 0;

for (const r of rows) {
  if (r.research_data?.slug) continue; // already has one
  const slug = ensureUniqueSlug(slugify(r.title || ''), (s) => taken.has(s), r.id);
  taken.add(slug);
  created++;
  console.log(`  ${slug}  ←  ${(r.title || '').slice(0, 50)}`);
  if (DRY) continue;
  const merged = { ...(r.research_data ?? {}), slug };
  const res = await rest(`events?id=eq.${r.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ research_data: merged }),
  });
  if (!res.ok) console.error(`  ✗ ${r.id}: HTTP ${res.status} ${await res.text()}`);
}

console.log(`\n${DRY ? 'would create' : 'created'} ${created} slug(s); ${rows.length - created} already had one.`);
