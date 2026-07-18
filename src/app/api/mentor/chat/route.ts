/**
 * POST /api/mentor/chat — one turn of the opportunity mentor.
 *
 * Signed-in only. Enforces a per-user daily cap via bump_mentor_usage, grounds
 * the reply in the opportunity's research_data + the caller's profile, and calls
 * the Gemini-first mentorLLM. Conversations are never stored — the client
 * re-sends the (trimmed) transcript each turn.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/supabase/server';
import { buildMentorPrompt, extractMentorEvent, type ChatMessage } from '@/lib/mentor-prompt';
import { mentorLLM } from '@/pipeline/mentor-llm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MENTOR_DAILY_LIMIT = 30;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { eventId, messages } = body ?? {};
  const locale: 'en' | 'uz' | 'ru' =
    body?.locale === 'uz' || body?.locale === 'ru' ? body.locale : 'en';
  if (!eventId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 1. Auth — validates the JWT from the session cookie.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = serviceClient();

  // 2. Rate limit (atomic increment; returns the new daily count).
  const { data: count, error: bumpErr } = await svc.rpc('bump_mentor_usage', { p_user: user.id });
  if (bumpErr) return NextResponse.json({ error: 'server_error' }, { status: 500 });
  if ((count as number) > MENTOR_DAILY_LIMIT) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // 3. Load the opportunity (service role) + the caller's own profile (RLS).
  const { data: eventRow } = await svc
    .from('events')
    .select('title, description, deadline, research_data')
    .eq('id', eventId)
    .single();
  if (!eventRow) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, age, country, interests')
    .eq('id', user.id)
    .single();
  const { count: savedCount } = await supabase
    .from('saved_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // 4. Build the grounded prompt and call the model.
  const prompt = buildMentorPrompt({
    event: extractMentorEvent(eventRow),
    profile: profile ? { ...profile, savedCount: savedCount ?? 0 } : null,
    messages: messages as ChatMessage[],
    locale,
  });

  try {
    const reply = await mentorLLM(prompt);
    return NextResponse.json({ reply: reply.trim() });
  } catch {
    return NextResponse.json({ error: 'busy' }, { status: 503 });
  }
}
