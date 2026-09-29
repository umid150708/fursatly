/**
 * Fursatly — take one listing off the site, reversibly.
 *
 *   node scripts/take-down.mjs --ad <id>                  paid promotion / advert
 *   node scripts/take-down.mjs --duplicate-of <keepId> <id> same listing as <keepId>
 *   add --dry-run to print the change without writing it
 *
 * The row is deactivated and marked, never deleted: an advert gets
 * research_data.rejected='advertisement' (its page answers 404, the enrich cron
 * never switches it back on), a duplicate gets research_data.duplicate_of. Rows
 * stay so the duplicate check still blocks a re-post. Undo by flipping
 * is_active back and removing the mark.
 */

import { loadEnv } from './lib/env.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rest = args.filter((a) => a !== '--dry-run');

let id;
let mark;
if (rest[0] === '--ad' && rest.length === 2) {
  id = rest[1];
  mark = { rejected: 'advertisement', rejectedAt: new Date().toISOString() };
} else if (rest[0] === '--duplicate-of' && rest.length === 3) {
  id = rest[2];
  mark = { duplicate_of: rest[1] };
} else {
  console.error('Usage: --ad <id> | --duplicate-of <keepId> <id>  [--dry-run]');
  process.exit(1);
}

const env = loadEnv();
const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events`;
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

/** The one listing with this id, or undefined (a malformed id is simply not found). */
const find = async (listingId, columns) => {
  const res = await fetch(`${base}?select=${columns}&id=eq.${encodeURIComponent(listingId)}`, { headers });
  const rows = res.ok ? await res.json() : [];
  return Array.isArray(rows) ? rows[0] : undefined;
};

const row = await find(id, 'id,title,is_active,research_data');
if (!row) { console.error(`No listing ${id}`); process.exit(1); }
if (mark.duplicate_of) {
  const keep = await find(mark.duplicate_of, 'id,is_active');
  if (!keep?.is_active) { console.error(`Listing to keep (${mark.duplicate_of}) is missing or not live`); process.exit(1); }
}

const research_data = { ...(row.research_data ?? {}), ...mark };
console.log(`${dryRun ? '[dry run] ' : ''}"${row.title}" → is_active=false, ${JSON.stringify(mark)}`);
if (dryRun) process.exit(0);

const res = await fetch(`${base}?id=eq.${id}`, {
  method: 'PATCH',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify({ is_active: false, research_data }),
});
if (!res.ok) { console.error(`Update failed: ${res.status} ${await res.text()}`); process.exit(1); }
console.log('Done.');
