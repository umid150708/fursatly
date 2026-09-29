/**
 * Production health, as the daily agent sees it (GET /api/cron/health).
 *
 * Every check here stands for a failure that went unnoticed for weeks in
 * Aug–Sep 2026: Vercel had no Gemini keys at all, Groq retired the model every
 * key asked for, and no listing was ingested or enriched. Local probes with the
 * Mac's keys could not see the first one, so this runs inside production.
 */

const HOUR = 3_600_000;
/** Channels post daily; three quiet days means ingestion is broken. */
const MAX_LISTING_GAP_HOURS = 72;
/** The enrich cron runs daily; a listing waiting longer was skipped. */
const MAX_QUEUE_WAIT_HOURS = 26;

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'TELEGRAM_BOT_TOKEN',
];

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** Settings production needs but lacks; a provider counts once for all its keys. */
export function missingEnv(env: Record<string, string | undefined>): string[] {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (![1, 2, 3, 4, 5, 6].some((i) => env[`GROQ_KEY_${i}`])) missing.push('GROQ_KEY_1..6 (any)');
  if (!['', '_2', '_3', '_4'].some((s) => env[`GEMINI_API_KEY${s}`])) missing.push('GEMINI_API_KEY (any of 1–4)');
  return missing;
}

/** Is the scrape → enrich pipeline still moving? */
export function pipelineCheck(
  state: { newestListingAt: string | null; oldestQueuedAt: string | null },
  now: number,
): Check {
  const hoursSince = (iso: string) => Math.round((now - Date.parse(`${iso.replace(/Z$/, '')}Z`)) / HOUR);
  const problems: string[] = [];
  if (!state.newestListingAt) problems.push('no listings at all');
  else if (hoursSince(state.newestListingAt) > MAX_LISTING_GAP_HOURS) {
    problems.push(`no new listing for ${hoursSince(state.newestListingAt)}h`);
  }
  if (state.oldestQueuedAt && hoursSince(state.oldestQueuedAt) > MAX_QUEUE_WAIT_HOURS) {
    problems.push(`a listing queued for ${hoursSince(state.oldestQueuedAt)}h without enrichment`);
  }
  return {
    name: 'pipeline',
    ok: problems.length === 0,
    detail: problems.join('; ') || `newest listing ${state.newestListingAt}`,
  };
}

/**
 * Run one live call, never throwing: a failure, a timeout or an answer slower
 * than `slowMs` becomes a failed check. The detail carries the time taken.
 */
export async function probe(
  name: string,
  call: () => Promise<string>,
  timeoutMs = 20_000,
  slowMs = Infinity,
): Promise<Check> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const answer = String(await Promise.race([call(), timeout])).trim();
    const ms = Date.now() - started;
    if (!answer) return { name, ok: false, detail: 'empty answer' };
    if (ms > slowMs) return { name, ok: false, detail: `slow: ${ms}ms (limit ${slowMs}ms)` };
    return { name, ok: true, detail: `${answer.slice(0, 60)} · ${ms}ms` };
  } catch (err) {
    return { name, ok: false, detail: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export function healthSummary(checks: Check[]) {
  const failing = checks.filter((c) => !c.ok).map((c) => c.name);
  return { ok: failing.length === 0, failing, checks };
}
