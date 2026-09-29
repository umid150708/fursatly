/**
 * GET /api/cron/health — production health for the daily agent.
 *
 * Runs inside production, so it sees production's own settings: a key that
 * exists on the Mac but not in Vercel (how the mentor lost Gemini in 2026)
 * fails here. Each Gemini and Groq key answers a one-word prompt, the mentor
 * answers a real one, and the pipeline must still be moving. Answers 503 when
 * anything fails; the body lists every check either way.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GeminiClient } from '@/pipeline/gemini';
import { GroqClient } from '@/pipeline/groq';
import { mentorLLM } from '@/pipeline/mentor-llm';
import { buildMentorPrompt } from '@/lib/mentor-prompt';
import { enrichQueueQuery } from '@/pipeline/enrich-queue';
import { missingEnv, pipelineCheck, probe, healthSummary, type Check } from '@/pipeline/health';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PING = 'Reply with the single word OK.';

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = process.env as Record<string, string | undefined>;
  const missing = missingEnv(env);
  const checks: Check[] = [
    { name: 'env', ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : 'all set' },
  ];

  const geminiKeys = ['', '_2', '_3', '_4'].map((s) => [`GEMINI_API_KEY${s}`, env[`GEMINI_API_KEY${s}`]] as const);
  const groqKeys = [1, 2, 3, 4, 5, 6].map((i) => [`GROQ_KEY_${i}`, env[`GROQ_KEY_${i}`]] as const);

  const probes: Promise<Check>[] = [
    // Slow counts as failing: the mentor gives Gemini 9s before trying Groq.
    ...geminiKeys.filter(([, k]) => k).map(([name, k]) =>
      probe(name, () => new GeminiClient([k!], undefined, { timeoutMs: 25_000 }).call(PING, 5), 30_000, 9_000)),
    ...groqKeys.filter(([, k]) => k).map(([name, k]) => probe(name, () => new GroqClient([k!]).call(PING, 5), 20_000, 5_000)),
    probe('mentor', () =>
      mentorLLM(
        buildMentorPrompt({
          event: { title: 'Chevening Scholarship', deadline: '2026-10-06', officialWebsite: 'https://www.chevening.org' },
          profile: null,
          messages: [{ role: 'user', content: 'menga yordam kerak' }],
          locale: 'uz',
        }),
        200,
      ),
    30_000,
    15_000,
    ),
  ];

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const database = (async (): Promise<Check[]> => {
    const [active, newest, queued] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('events').select('created_at').order('created_at', { ascending: false }).limit(1),
      enrichQueueQuery(supabase, 1),
    ]);
    const error = active.error ?? newest.error ?? queued.error;
    if (error) return [{ name: 'database', ok: false, detail: error.message }];
    return [
      { name: 'database', ok: (active.count ?? 0) > 0, detail: `${active.count ?? 0} live listings` },
      pipelineCheck(
        {
          newestListingAt: newest.data?.[0]?.created_at ?? null,
          oldestQueuedAt: (queued.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
        },
        Date.now(),
      ),
    ];
  })().catch((err): Check[] => [{ name: 'database', ok: false, detail: String(err?.message ?? err) }]);

  checks.push(...(await Promise.all(probes)), ...(await database));
  const summary = healthSummary(checks);
  return NextResponse.json({ ...summary, at: new Date().toISOString() }, { status: summary.ok ? 200 : 503 });
}
