/**
 * Fursatly — Google Search Console from the terminal.
 *
 * The property https://fursatly.uz/ is owned by the service account
 * fursatly-seo@fursatly-search.iam.gserviceaccount.com (verified with the
 * google-site-verification meta tag in src/app/layout.tsx). Whoever is logged
 * in to gcloud with Token Creator on that account can act as it — no key file.
 *
 *   node scripts/search-console.mjs status   # sitemap state + is the homepage indexed
 *   node scripts/search-console.mjs submit   # (re)submit the sitemap
 *   node scripts/search-console.mjs inspect https://fursatly.uz/event/<slug>
 */

import { execFileSync } from 'node:child_process';

const SA = 'fursatly-seo@fursatly-search.iam.gserviceaccount.com';
const SITE = 'https://fursatly.uz/';
const SITEMAP = 'https://fursatly.uz/sitemap.xml';
const WM = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`;

const token = execFileSync('gcloud', [
  'auth', 'print-access-token', `--impersonate-service-account=${SA}`,
  '--scopes=https://www.googleapis.com/auth/webmasters',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function inspect(url) {
  const { inspectionResult: r } = await api('POST', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    inspectionUrl: url, siteUrl: SITE,
  });
  const i = r.indexStatusResult;
  console.log(`${url}\n  ${i.verdict} · ${i.coverageState}${i.lastCrawlTime ? ` · crawled ${i.lastCrawlTime}` : ''}`);
}

const [cmd = 'status', arg] = process.argv.slice(2);

if (cmd === 'submit') {
  await api('PUT', WM).catch(() => {}); // adds the site to the account's list; harmless if present
  await api('PUT', `${WM}/sitemaps/${encodeURIComponent(SITEMAP)}`);
  console.log(`Submitted ${SITEMAP}`);
} else if (cmd === 'inspect' && arg) {
  await inspect(arg);
} else if (cmd === 'status') {
  const { sitemap = [] } = await api('GET', `${WM}/sitemaps`);
  for (const s of sitemap) {
    const urls = s.contents?.map((c) => `${c.submitted} submitted`).join(', ') ?? 'not read yet';
    console.log(`${s.path}\n  last read ${s.lastDownloaded ?? 'never'} · ${urls} · ${s.errors ?? 0} errors`);
  }
  if (!sitemap.length) console.log('No sitemap submitted — run: node scripts/search-console.mjs submit');
  await inspect(SITE);
} else {
  console.error('Usage: node scripts/search-console.mjs status | submit | inspect <url>');
  process.exit(1);
}
