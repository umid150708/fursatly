/**
 * Fursatly — the daily agent's report (see docs/superpowers/specs/2026-09-30-daily-agent-design.md).
 *
 * Gathers everything the agent judges in one JSON document on stdout:
 *   health      GET /api/cron/health (providers, mentor, database, pipeline)
 *   pages       status codes of the pages students land on
 *   deployment  the latest production deployment on Vercel
 *   errors      production 5xx responses and error logs since the last review
 *   newListings listings that went live since the last review, with any
 *               paid-placement marker (src/pipeline/promo.mjs)
 *   duplicates  the ingestion rules replayed over the live table: sure matches,
 *               and suspects for the agent to judge
 *   issues      one line per thing that needs a look
 *
 * State lives in ~/.fursatly-watchdog/ (outside the repo):
 *   node scripts/watchdog.mjs                    → report (also saved to reports/)
 *   node scripts/watchdog.mjs --mark-reviewed    → the last report is handled; move the cursor
 *   node scripts/watchdog.mjs --not-duplicate A B → never suspect listings A and B again
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.mjs';
import { paidPromotionMarker } from '../src/pipeline/promo.mjs';
import { findDuplicate, suspectDuplicates } from '../src/pipeline/dedupe.mjs';

const SITE = 'https://fursatly.uz';
const REPO = fileURLToPath(new URL('..', import.meta.url));
const STATE_DIR = join(homedir(), '.fursatly-watchdog');
const STATE_FILE = join(STATE_DIR, 'state.json');
const DAY = 86_400_000;

mkdirSync(join(STATE_DIR, 'reports'), { recursive: true });
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const pairKey = (a, b) => [a, b].sort().join('|');

const args = process.argv.slice(2);
if (args[0] === '--mark-reviewed') {
  if (!state.lastReportAt) { console.error('No report to mark reviewed.'); process.exit(1); }
  state.reviewedAt = state.lastReportAt;
  saveState();
  console.log(`Reviewed up to ${state.reviewedAt}`);
  process.exit(0);
}
if (args[0] === '--not-duplicate') {
  if (args.length !== 3) { console.error('Usage: --not-duplicate <idA> <idB>'); process.exit(1); }
  state.notDuplicates = [...new Set([...(state.notDuplicates ?? []), pairKey(args[1], args[2])])];
  saveState();
  console.log(`Recorded ${args[1]} and ${args[2]} as different listings.`);
  process.exit(0);
}

const env = loadEnv();
const startedAt = new Date().toISOString();
const since = state.reviewedAt ?? new Date(Date.now() - DAY).toISOString();
const report = { startedAt, since };
const issues = [];

// ── Health, from inside production ───────────────────────────────────────────
try {
  const res = await fetch(`${SITE}/api/cron/health`, {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    signal: AbortSignal.timeout(90_000),
  });
  report.health = await res.json();
  for (const c of report.health.checks ?? []) if (!c.ok) issues.push(`health: ${c.name} — ${c.detail}`);
} catch (err) {
  report.health = { ok: false, error: String(err.message ?? err) };
  issues.push(`health: endpoint unreachable — ${report.health.error}`);
}

// ── Database: live listings ──────────────────────────────────────────────────
const db = (path) =>
  fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Supabase ${r.status}`))));

const linkOf = (description) => [...String(description ?? '').matchAll(/🔗\s*(\S+)/g)].map((m) => m[1]);
let live = [];
try {
  live = await db('events?select=id,title,source,location,deadline,description,created_at,research_data&is_active=eq.true&order=created_at.asc&limit=5000');
} catch (err) {
  issues.push(`database: ${err.message}`);
}

// ── Pages students land on ───────────────────────────────────────────────────
const newestSlug = live.at(-1)?.research_data?.slug;
report.pages = {};
for (const path of ['/', '/?cat=Scholarships', ...(newestSlug ? [`/event/${newestSlug}`] : [])]) {
  try {
    const res = await fetch(`${SITE}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    report.pages[path] = res.status;
    if (res.status >= 400) issues.push(`page ${path} answers ${res.status}`);
  } catch (err) {
    report.pages[path] = String(err.message ?? err);
    issues.push(`page ${path} unreachable`);
  }
}

// ── Vercel: latest production deployment and errors ──────────────────────────
try {
  const { projects: [{ id: projectId, orgId: teamId }] } = JSON.parse(readFileSync(join(REPO, '.vercel/repo.json'), 'utf8'));
  const auth = join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
  const { token } = JSON.parse(readFileSync(auth, 'utf8'));
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&target=production&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const d = (await res.json()).deployments?.[0];
  report.deployment = d && { state: d.state ?? d.readyState, url: d.url, createdAt: new Date(d.created).toISOString(), sha: d.meta?.githubCommitSha?.slice(0, 7) };
  if (report.deployment?.state !== 'READY') issues.push(`deployment: latest production build is ${report.deployment?.state ?? 'missing'}`);

  const vercel = existsSync(join(homedir(), '.local/bin/vercel')) ? join(homedir(), '.local/bin/vercel') : 'vercel';
  const logs = (extra) => {
    const out = execFileSync(vercel, ['logs', '--environment', 'production', '--since', since, '--json', '--limit', '200', '--scope', teamId, ...extra],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 90_000 });
    return out.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
  };
  const seen = new Map();
  for (const e of [...logs(['--level', 'error']), ...logs(['--status-code', '5xx'])]) {
    const key = `${e.responseStatusCode ?? ''} ${e.requestPath ?? ''} ${String(e.message ?? '').slice(0, 160)}`.trim();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  report.errors = [...seen].map(([what, count]) => ({ what, count })).sort((a, b) => b.count - a.count);
  if (report.errors.length) issues.push(`errors: ${report.errors.length} kind(s) of production error since ${since}`);
} catch (err) {
  report.deployment ??= { error: String(err.message ?? err) };
  issues.push(`vercel: could not read deployments/logs — ${String(err.message ?? err).slice(0, 160)}`);
}

// ── New listings since the last review ───────────────────────────────────────
report.newListings = live
  .filter((e) => (e.research_data?.lastEnrichedAt ?? e.created_at) > since)
  .map((e) => ({
    id: e.id,
    title: e.title,
    category: e.source,
    location: e.location,
    deadline: e.deadline?.slice(0, 10) ?? null,
    link: linkOf(e.description)[0] ?? null,
    officialWebsite: e.research_data?.officialWebsite ?? null,
    description: String(e.description ?? '').replace(/\s+/g, ' ').slice(0, 400),
    paidMarker: paidPromotionMarker(`${e.description ?? ''} ${e.research_data?.officialWebsite ?? ''}`),
  }));
for (const l of report.newListings) if (l.paidMarker) issues.push(`ad marker "${l.paidMarker}" on live listing ${l.id} "${l.title}"`);

// ── Duplicates among live listings ───────────────────────────────────────────
const judged = new Set(state.notDuplicates ?? []);
const kept = [];
report.duplicates = [];
report.suspects = [];
for (const e of live) {
  const row = { id: e.id, title: e.title, deadline: e.deadline, description: e.description, urls: linkOf(e.description) };
  const original = findDuplicate(row, kept);
  if (original) { report.duplicates.push({ keep: [original.id, original.title], drop: [row.id, row.title] }); continue; }
  for (const s of suspectDuplicates(row, kept)) {
    if (!judged.has(pairKey(s.id, row.id))) report.suspects.push({ a: [s.id, s.title], b: [row.id, row.title] });
  }
  kept.push(row);
}
if (report.duplicates.length) issues.push(`${report.duplicates.length} duplicate(s) live — scripts/dedupe-events.mjs --apply`);
if (report.suspects.length) issues.push(`${report.suspects.length} suspected duplicate pair(s) to judge`);
if (report.newListings.length) issues.push(`${report.newListings.length} new listing(s) to review for ads`);

report.issues = issues;
report.ok = issues.length === 0;
state.lastReportAt = startedAt;
saveState();
writeFileSync(join(STATE_DIR, 'reports', `${startedAt.slice(0, 10)}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
