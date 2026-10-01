/**
 * Fursatly — tell Bing, Yandex and the other IndexNow engines which pages
 * changed, so new opportunities show up in their search within hours instead
 * of waiting for a crawl. Google does not take IndexNow; it reads the sitemap
 * submitted in Search Console (scripts/search-console.mjs).
 *
 * The key is the file public/<key>.txt, served at https://fursatly.uz/<key>.txt
 * so the engines can check the ping really comes from the site owner.
 *
 *   node scripts/indexnow.mjs          # pages changed in the last 2 days
 *   node scripts/indexnow.mjs --all    # every page in the sitemap
 */

import { readdirSync } from 'node:fs';

const SITE = 'https://fursatly.uz';
const DAYS = 2;

const keyFile = readdirSync(new URL('../public/', import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('No IndexNow key file (public/<32 hex>.txt)'); process.exit(1); }
const key = keyFile.replace(/\.txt$/, '');

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => ({
  loc: block.match(/<loc>(.*?)<\/loc>/)?.[1],
  lastmod: block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
})).filter((e) => e.loc);

const all = process.argv.includes('--all');
const since = Date.now() - DAYS * 86_400_000;
const urlList = entries
  .filter((e) => all || e.loc === SITE || (e.lastmod && Date.parse(e.lastmod) >= since))
  .map((e) => e.loc);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${keyFile}`, urlList }),
});
// 200 = accepted, 202 = accepted while the key is still being checked.
if (res.status !== 200 && res.status !== 202) {
  console.error(`IndexNow refused (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log(`IndexNow: submitted ${urlList.length} of ${entries.length} sitemap URLs (${res.status}).`);
