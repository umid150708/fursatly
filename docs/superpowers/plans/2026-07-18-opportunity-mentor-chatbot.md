# Opportunity Mentor Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed-in, personalised AI mentor to every opportunity page that answers grounded questions and gives study-abroad guidance, reusing the free Groq/Gemini infra with no stored conversations.

**Architecture:** A floating panel on `/event/[id]` holds the conversation in React state and POSTs each turn to a stateless `/api/mentor/chat` route. The route auth-gates on the Supabase session, enforces a daily message cap via a `mentor_usage` ledger, loads the opportunity + the caller's profile, builds a single grounded prompt, and calls a Gemini-first `mentorLLM()` wrapper.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, Supabase (`@supabase/ssr` cookie client + service-role client), vitest, Tailwind, existing `gemini`/`groq` pipeline singletons.

## Global Constraints

- Provider order for chat: **Gemini first, Groq fallback** (inverse of `callLLM`). Reuse existing `gemini`/`groq` singletons — no new SDK, no new API keys.
- Conversations are **ephemeral** — never persist chat messages. The only new table is the `mentor_usage` rate-limit ledger.
- `mentor_usage` is **service-role only** (RLS enabled, no policies). `bump_mentor_usage` is **NOT** `security definer`.
- Daily cap: `MENTOR_DAILY_LIMIT = 30` messages/user/day.
- Chat requires a signed-in user; signed-out taps route to `/auth?next=/event/<id>` (mirror `SaveButton`).
- Trilingual: reply language follows the site `locale` (`en` | `uz` | `ru`). All new UI strings go in `src/lib/translations.ts` for all three locales.
- Grounding rule (in prompt): never invent deadlines, eligibility, or links.

---

### Task 1: Database migration — `mentor_usage` ledger + `bump_mentor_usage` RPC

**Files:**
- Create: `supabase/migrations/20260718090000_mentor_usage.sql`

**Interfaces:**
- Produces: table `public.mentor_usage(user_id uuid, day date, count int)`; RPC `public.bump_mentor_usage(p_user uuid) returns int` (returns the new daily count for that user).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260718090000_mentor_usage.sql`:

```sql
-- Mentor chatbot rate-limit ledger. NOT chat history — just a daily counter so
-- one signed-in user can't burn the shared free LLM keys. Service-role only.

create table if not exists public.mentor_usage (
  user_id uuid  not null references auth.users(id) on delete cascade,
  day     date  not null default current_date,
  count   int   not null default 0,
  primary key (user_id, day)
);

alter table public.mentor_usage enable row level security;
-- No policies → only the service role (used by the route) can read/write.

-- Atomic increment; returns the new daily count. NOT security definer: runs with
-- the caller's rights, so the service-role route works (bypasses RLS) while a
-- direct authenticated call hits the no-policy RLS and fails — no one can inflate
-- another user's counter.
create or replace function public.bump_mentor_usage(p_user uuid)
returns int
language plpgsql
as $$
declare new_count int;
begin
  insert into public.mentor_usage (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day)
  do update set count = public.mentor_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
```

- [ ] **Step 2: Verify the file contains both objects (dry check)**

Run: `grep -cE "create table if not exists public.mentor_usage|create or replace function public.bump_mentor_usage" supabase/migrations/20260718090000_mentor_usage.sql`
Expected: `2` (the table and the function are both present — confirms the file was written, not a syntax proof).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260718090000_mentor_usage.sql
git commit -m "Add mentor_usage rate-limit ledger + bump_mentor_usage RPC"
```

> **Note (external, not code):** apply this migration to the hosted DB via the same flow used for the accounts migration before the route is exercised in production.

---

### Task 2: Prompt builder — `src/lib/mentor-prompt.ts` (pure, TDD)

**Files:**
- Create: `src/lib/mentor-prompt.ts`
- Test: `tests/mentor-prompt.test.ts`

**Interfaces:**
- Produces:
  - `type ChatRole = 'user' | 'assistant'`
  - `interface ChatMessage { role: ChatRole; content: string }`
  - `interface MentorEvent { title: string; deadline?: string | null; organisation?: string | null; officialWebsite?: string | null; extendedDescription?: string | null; keyDetails?: string[]; benefits?: string[]; eligibility?: string[] }`
  - `interface MentorProfile { display_name?: string | null; age?: number | null; country?: string | null; interests?: string[] | null; savedCount?: number }`
  - `function trimHistory(messages: ChatMessage[], maxMessages?: number): ChatMessage[]` (default 16)
  - `function extractMentorEvent(row: any): MentorEvent`
  - `function buildMentorPrompt(input: { event: MentorEvent; profile: MentorProfile | null; messages: ChatMessage[]; locale: 'en' | 'uz' | 'ru' }): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/mentor-prompt.test.ts`:

```ts
/** Unit tests for the mentor prompt builder — pure string composition. */
import { describe, it, expect } from 'vitest';
import {
  trimHistory,
  extractMentorEvent,
  buildMentorPrompt,
  type ChatMessage,
} from '../src/lib/mentor-prompt';

const msgs = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `m${i}`,
  }));

describe('trimHistory', () => {
  it('keeps the last 16 messages by default', () => {
    const out = trimHistory(msgs(20));
    expect(out).toHaveLength(16);
    expect(out[0].content).toBe('m4');
    expect(out[15].content).toBe('m19');
  });
  it('returns everything when under the cap', () => {
    expect(trimHistory(msgs(3))).toHaveLength(3);
  });
});

describe('extractMentorEvent', () => {
  it('maps event columns + research_data into clean facts', () => {
    const ev = extractMentorEvent({
      title: 'Chevening',
      deadline: '2026-11-01',
      description: 'fallback desc',
      research_data: {
        organisation: 'UK Gov',
        officialWebsite: 'https://chevening.org',
        extendedDescription: 'Full scholarship',
        keyDetails: ['Fully funded', { text: 'Any UK university' }],
        competitionTips: ['Start early'],
        eligibilityCriteria: ['2 years work experience'],
      },
    });
    expect(ev.title).toBe('Chevening');
    expect(ev.organisation).toBe('UK Gov');
    expect(ev.officialWebsite).toBe('https://chevening.org');
    expect(ev.keyDetails).toEqual(['Fully funded', 'Any UK university']);
    expect(ev.benefits).toEqual(['Start early']);
    expect(ev.eligibility).toEqual(['2 years work experience']);
  });
  it('falls back to description when extendedDescription is missing', () => {
    const ev = extractMentorEvent({ title: 'X', description: 'plain', research_data: {} });
    expect(ev.extendedDescription).toBe('plain');
  });
  it('tolerates a null research_data', () => {
    const ev = extractMentorEvent({ title: 'X', description: 'd', research_data: null });
    expect(ev.title).toBe('X');
    expect(ev.keyDetails).toEqual([]);
  });
});

describe('buildMentorPrompt', () => {
  const event = {
    title: 'Chevening',
    deadline: '2026-11-01',
    officialWebsite: 'https://chevening.org',
    eligibility: ['2 years work experience'],
  };

  it('grounds the prompt in the opportunity facts', () => {
    const p = buildMentorPrompt({ event, profile: null, messages: msgs(1), locale: 'en' });
    expect(p).toContain('Chevening');
    expect(p).toContain('2026-11-01');
    expect(p).toContain('https://chevening.org');
    expect(p).toContain('2 years work experience');
    expect(p).toContain('No profile details available');
  });

  it('includes profile fields when present', () => {
    const p = buildMentorPrompt({
      event,
      profile: { display_name: 'Aziz', age: 17, country: 'Uzbekistan', interests: ['CS'], savedCount: 4 },
      messages: msgs(1),
      locale: 'en',
    });
    expect(p).toContain('Aziz');
    expect(p).toContain('17');
    expect(p).toContain('Uzbekistan');
    expect(p).toContain('CS');
  });

  it('names the reply language from locale', () => {
    expect(buildMentorPrompt({ event, profile: null, messages: msgs(1), locale: 'uz' })).toContain('Uzbek');
    expect(buildMentorPrompt({ event, profile: null, messages: msgs(1), locale: 'ru' })).toContain('Russian');
  });

  it('includes guardrail lines and the transcript', () => {
    const p = buildMentorPrompt({
      event,
      profile: null,
      messages: [{ role: 'user', content: 'Am I eligible?' }],
      locale: 'en',
    });
    expect(p).toContain('Never invent');
    expect(p).toContain('Student: Am I eligible?');
    expect(p.trimEnd().endsWith('Mentor:')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mentor-prompt.test.ts`
Expected: FAIL — cannot resolve `../src/lib/mentor-prompt`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mentor-prompt.ts`:

```ts
/**
 * Pure prompt composition for the opportunity mentor. No I/O — the route feeds
 * it an event row + the caller's profile and gets back a single flattened prompt
 * string suitable for the existing single-string LLM clients.
 */

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface MentorEvent {
  title: string;
  deadline?: string | null;
  organisation?: string | null;
  officialWebsite?: string | null;
  extendedDescription?: string | null;
  keyDetails?: string[];
  benefits?: string[];
  eligibility?: string[];
}

export interface MentorProfile {
  display_name?: string | null;
  age?: number | null;
  country?: string | null;
  interests?: string[] | null;
  savedCount?: number;
}

const MAX_HISTORY_MESSAGES = 16; // ~8 exchanges — bounds token cost
const LANG_NAME: Record<'en' | 'uz' | 'ru', string> = {
  en: 'English',
  uz: 'Uzbek',
  ru: 'Russian',
};

/** A research list item may be a plain string or an object — normalise to text. */
const asText = (x: any): string =>
  (typeof x === 'string' ? x : x?.value || x?.text || x?.detail || x?.description || x?.name || '')
    .toString()
    .trim();

const cleanList = (items: any): string[] =>
  Array.isArray(items) ? items.map(asText).filter((s) => s.length > 0) : [];

/** Keep only the most recent messages so long chats stay within token budget. */
export function trimHistory(messages: ChatMessage[], maxMessages = MAX_HISTORY_MESSAGES): ChatMessage[] {
  return messages.slice(-maxMessages);
}

/** Map a raw Supabase event row (+ research_data) into clean mentor facts. */
export function extractMentorEvent(row: any): MentorEvent {
  const rd = row?.research_data ?? {};
  return {
    title: row?.title ?? '',
    deadline: row?.deadline ?? null,
    organisation: rd.organisation ?? null,
    officialWebsite: rd.officialWebsite ?? null,
    extendedDescription: rd.extendedDescription ?? row?.description ?? null,
    keyDetails: cleanList(rd.keyDetails),
    benefits: cleanList(rd.competitionTips ?? rd.eventTips),
    eligibility: cleanList(rd.eligibilityCriteria),
  };
}

function factLines(event: MentorEvent): string {
  const lines: string[] = [`Title: ${event.title}`];
  if (event.organisation) lines.push(`Organiser: ${event.organisation}`);
  if (event.deadline) lines.push(`Deadline: ${event.deadline}`);
  if (event.officialWebsite) lines.push(`Official website: ${event.officialWebsite}`);
  if (event.extendedDescription) lines.push(`About: ${event.extendedDescription}`);
  if (event.keyDetails?.length) lines.push(`Key details: ${event.keyDetails.join('; ')}`);
  if (event.benefits?.length) lines.push(`Benefits: ${event.benefits.join('; ')}`);
  if (event.eligibility?.length) lines.push(`Eligibility: ${event.eligibility.join('; ')}`);
  return lines.join('\n');
}

function profileLines(profile: MentorProfile | null): string {
  if (!profile) return 'No profile details available.';
  const lines: string[] = [];
  if (profile.display_name) lines.push(`Name: ${profile.display_name}`);
  if (profile.age != null) lines.push(`Age: ${profile.age}`);
  if (profile.country) lines.push(`Country: ${profile.country}`);
  if (profile.interests?.length) lines.push(`Interests: ${profile.interests.join(', ')}`);
  if (profile.savedCount != null) lines.push(`Saved opportunities: ${profile.savedCount}`);
  return lines.length ? lines.join('\n') : 'No profile details available.';
}

export function buildMentorPrompt(input: {
  event: MentorEvent;
  profile: MentorProfile | null;
  messages: ChatMessage[];
  locale: 'en' | 'uz' | 'ru';
}): string {
  const { event, profile, messages, locale } = input;
  const transcript = trimHistory(messages)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`)
    .join('\n');

  return [
    'You are Fursatly Mentor, a warm and practical guide for Central Asian students exploring scholarships, competitions, and study-abroad opportunities.',
    '',
    'THE OPPORTUNITY THE STUDENT IS VIEWING:',
    factLines(event),
    '',
    'ABOUT THE STUDENT:',
    profileLines(profile),
    '',
    'RULES:',
    '- Help with education, opportunities, studying abroad, and careers. If the student asks something clearly unrelated, gently steer back to how you can help.',
    '- Ground any claim about THIS opportunity in the facts above. Never invent deadlines, eligibility, or links. If a detail is not provided, say so and point them to the official website.',
    '- If you are unsure, say so instead of guessing.',
    `- Reply in ${LANG_NAME[locale]}.`,
    '- Be concise and give actionable next steps.',
    '',
    'CONVERSATION SO FAR:',
    transcript,
    '',
    'Mentor:',
  ].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mentor-prompt.test.ts`
Expected: PASS (all in this file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mentor-prompt.ts tests/mentor-prompt.test.ts
git commit -m "Add grounded mentor prompt builder (pure, tested)"
```

---

### Task 3: Provider wrapper — `src/pipeline/mentor-llm.ts` (Gemini-first, TDD)

**Files:**
- Create: `src/pipeline/mentor-llm.ts`
- Test: `tests/mentor-llm.test.ts`

**Interfaces:**
- Consumes: `gemini`, `groq` singletons from `./gemini` / `./groq` (both expose `call(prompt, maxTokens?): Promise<string>`; `gemini` also has `available: boolean`).
- Produces: `interface LLMProvider { call(prompt: string, maxTokens?: number): Promise<string>; available?: boolean }` and `function mentorLLM(prompt: string, maxTokens?: number, providers?: LLMProvider[]): Promise<string>` (default providers `[gemini, groq]`, default maxTokens 600).

- [ ] **Step 1: Write the failing tests**

Create `tests/mentor-llm.test.ts`:

```ts
/** Fallback ordering for the chat LLM wrapper — no network, fake providers. */
import { describe, it, expect, vi } from 'vitest';
import { mentorLLM, type LLMProvider } from '../src/pipeline/mentor-llm';

const ok = (text: string): LLMProvider => ({ call: vi.fn().mockResolvedValue(text) });
const fail = (): LLMProvider => ({ call: vi.fn().mockRejectedValue(new Error('throttled')) });

describe('mentorLLM', () => {
  it('uses the first provider when it succeeds', async () => {
    const first = ok('from-gemini');
    const second = ok('from-groq');
    const out = await mentorLLM('hi', 100, [first, second]);
    expect(out).toBe('from-gemini');
    expect(second.call).not.toHaveBeenCalled();
  });

  it('falls back to the next provider when the first throws', async () => {
    const out = await mentorLLM('hi', 100, [fail(), ok('from-groq')]);
    expect(out).toBe('from-groq');
  });

  it('skips providers marked unavailable', async () => {
    const unavailable: LLMProvider = { call: vi.fn(), available: false };
    const out = await mentorLLM('hi', 100, [unavailable, ok('from-groq')]);
    expect(out).toBe('from-groq');
    expect(unavailable.call).not.toHaveBeenCalled();
  });

  it('throws when every provider fails', async () => {
    await expect(mentorLLM('hi', 100, [fail(), fail()])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mentor-llm.test.ts`
Expected: FAIL — cannot resolve `../src/pipeline/mentor-llm`.

- [ ] **Step 3: Write the implementation**

Create `src/pipeline/mentor-llm.ts`:

```ts
/**
 * Chat LLM entry point. Unlike the pipeline's callLLM (Groq-first), the mentor
 * prefers Gemini: it handles Uzbek/Russian better and doesn't contend with the
 * Groq-heavy enrichment cron. Falls back to Groq; throws only if all fail.
 */
import { gemini } from './gemini';
import { groq } from './groq';

export interface LLMProvider {
  call(prompt: string, maxTokens?: number): Promise<string>;
  available?: boolean;
}

export async function mentorLLM(
  prompt: string,
  maxTokens = 600,
  providers: LLMProvider[] = [gemini, groq],
): Promise<string> {
  let lastErr: unknown;
  for (const provider of providers) {
    if (provider.available === false) continue;
    try {
      return await provider.call(prompt, maxTokens);
    } catch (err) {
      lastErr = err;
      console.warn('[mentorLLM] provider failed, trying next:', err instanceof Error ? err.message : err);
    }
  }
  throw lastErr ?? new Error('No mentor LLM providers available');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mentor-llm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/mentor-llm.ts tests/mentor-llm.test.ts
git commit -m "Add Gemini-first mentorLLM wrapper with fallback"
```

---

### Task 4: Route handler — `src/app/api/mentor/chat/route.ts`

**Files:**
- Create: `src/app/api/mentor/chat/route.ts`

**Interfaces:**
- Consumes: `createServerSupabase` from `@/supabase/server`; `createClient` from `@supabase/supabase-js`; `buildMentorPrompt`, `extractMentorEvent`, `type ChatMessage` from `@/lib/mentor-prompt`; `mentorLLM` from `@/pipeline/mentor-llm`; RPC `bump_mentor_usage`.
- Produces: `POST /api/mentor/chat` accepting `{ eventId: string; messages: ChatMessage[]; locale?: 'en'|'uz'|'ru' }`, returning `{ reply: string }` (200) or `{ error }` with status 400/401/404/429/500/503.

- [ ] **Step 1: Write the route**

Create `src/app/api/mentor/chat/route.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mentor/chat/route.ts
git commit -m "Add /api/mentor/chat route (auth-gated, rate-limited, grounded)"
```

---

### Task 5: UI — `MentorPanel` + translations + wire into the opportunity page

**Files:**
- Create: `src/components/mentor/MentorPanel.tsx`
- Modify: `src/lib/translations.ts` (add mentor keys to `en`, `uz`, `ru`)
- Modify: `src/app/event/[id]/page.tsx` (import + mount `<MentorPanel eventId={event.id} />`)

**Interfaces:**
- Consumes: `useAuth` (`{ user }`), `useLanguage` (`{ t, locale }`), `useRouter`; POSTs to `/api/mentor/chat`; `ChatMessage` shape `{ role, content }`.
- Produces: `export function MentorPanel({ eventId }: { eventId: string })`.

- [ ] **Step 1: Add translation keys**

In `src/lib/translations.ts`, add these keys inside each locale object (`en`, then `uz`, then `ru`) — near the account/save keys. Use a `// Mentor chatbot` comment marker.

English (`en`):
```ts
    // Mentor chatbot
    mentorTitle: 'Ask the Mentor',
    mentorSubtitle: 'Personalised guidance on this opportunity and studying abroad',
    mentorPlaceholder: 'Ask anything about this opportunity or studying abroad…',
    mentorSend: 'Send',
    mentorGreeting: 'Hi! I can help you understand this opportunity, check how it fits you, and plan your next steps. What would you like to know?',
    mentorSignIn: 'Sign in to chat with the mentor',
    mentorTyping: 'Mentor is typing…',
    mentorErrorBusy: 'The mentor is busy right now. Please try again in a moment.',
    mentorErrorRate: "You've reached today's message limit. Come back tomorrow!",
    mentorErrorGeneric: 'Something went wrong. Please try again.',
```

Uzbek (`uz`):
```ts
    // Mentor chatbot
    mentorTitle: 'Mentordan so‘rang',
    mentorSubtitle: 'Ushbu imkoniyat va chet elda o‘qish bo‘yicha shaxsiy maslahat',
    mentorPlaceholder: 'Ushbu imkoniyat yoki chet elda o‘qish haqida so‘rang…',
    mentorSend: 'Yuborish',
    mentorGreeting: 'Salom! Men bu imkoniyatni tushunishga, sizga mosligini baholashga va keyingi qadamlarni rejalashtirishga yordam beraman. Nimani bilmoqchisiz?',
    mentorSignIn: 'Mentor bilan suhbatlashish uchun kiring',
    mentorTyping: 'Mentor yozmoqda…',
    mentorErrorBusy: 'Mentor hozir band. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
    mentorErrorRate: 'Bugungi xabarlar chegarasiga yetdingiz. Ertaga qaytib keling!',
    mentorErrorGeneric: 'Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
```

Russian (`ru`):
```ts
    // Mentor chatbot
    mentorTitle: 'Спросить ментора',
    mentorSubtitle: 'Персональные советы по этой возможности и учёбе за рубежом',
    mentorPlaceholder: 'Спросите об этой возможности или учёбе за рубежом…',
    mentorSend: 'Отправить',
    mentorGreeting: 'Привет! Я помогу разобраться в этой возможности, оценить, подходит ли она вам, и спланировать следующие шаги. Что вы хотите узнать?',
    mentorSignIn: 'Войдите, чтобы общаться с ментором',
    mentorTyping: 'Ментор печатает…',
    mentorErrorBusy: 'Ментор сейчас занят. Пожалуйста, попробуйте ещё раз чуть позже.',
    mentorErrorRate: 'Вы достигли дневного лимита сообщений. Возвращайтесь завтра!',
    mentorErrorGeneric: 'Что-то пошло не так. Пожалуйста, попробуйте ещё раз.',
```

- [ ] **Step 2: Typecheck to confirm all three locales are consistent**

Run: `npm run typecheck`
Expected: no errors (the `translations` object is structurally typed — a key missing from one locale would error).

- [ ] **Step 3: Write the `MentorPanel` component**

Create `src/components/mentor/MentorPanel.tsx`:

```tsx
'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/supabase';
import { useLanguage } from '@/context/LanguageContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Floating mentor chat on the opportunity page. Conversation lives in local
 * state only (ephemeral). Signed-out taps route to /auth. Each turn posts the
 * running transcript to /api/mentor/chat and appends the reply.
 */
export function MentorPanel({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const openPanel = () => {
    if (!user) {
      router.push(`/auth?next=/event/${eventId}`);
      return;
    }
    setOpen(true);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);
    scrollToEnd();

    try {
      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, messages: next, locale }),
      });

      if (res.status === 401) {
        router.push(`/auth?next=/event/${eventId}`);
        return;
      }
      if (res.status === 429) {
        setError(t.mentorErrorRate);
        return;
      }
      if (!res.ok) {
        setError(res.status === 503 ? t.mentorErrorBusy : t.mentorErrorGeneric);
        return;
      }

      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      scrollToEnd();
    } catch {
      setError(t.mentorErrorGeneric);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Launcher bubble */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label={t.mentorTitle}
          className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div className="min-w-0">
              <p className="font-display font-semibold leading-tight">{t.mentorTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.mentorSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                {t.mentorGreeting}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.mentorTyping}
              </div>
            )}
            {error && <p className="text-sm text-urgent">{error}</p>}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.mentorPlaceholder}
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t.mentorSend}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Mount it on the opportunity page**

In `src/app/event/[id]/page.tsx`:

Add the import beside the other component imports (after the `SaveButton` import line):
```tsx
import { MentorPanel } from '@/components/mentor/MentorPanel';
```

Render it just before the closing `</div>` that wraps the page — immediately after `<SiteFooter ... />`:
```tsx
      <SiteFooter t={t} onCategory={() => router.push('/')} />
      <MentorPanel eventId={event.id} />
    </div>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/mentor/MentorPanel.tsx src/lib/translations.ts "src/app/event/[id]/page.tsx"
git commit -m "Add floating MentorPanel to opportunity pages + trilingual copy"
```

---

### Task 6: Full verification + deploy decision

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all prior tests + the new `mentor-prompt` and `mentor-llm` suites PASS (was 70; now 70 + new cases).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: compiles clean; `/api/mentor/chat` appears in the route list.

- [ ] **Step 3: Browser E2E (signed-out gate)**

Start the dev server (`fursatly-dev-9102`), open an opportunity page, click the mentor bubble → expect redirect to `/auth?next=/event/<id>`. Use `read_page` / screenshot to confirm.

- [ ] **Step 4: Browser E2E (signed-in chat)** — requires the migration applied to the DB

With a signed-in session, open the panel, send "What is the deadline and am I eligible?", and confirm a grounded reply appears (deadline pulled from the opportunity). Confirm via screenshot + `read_network_requests` that `/api/mentor/chat` returned 200.

- [ ] **Step 5: Report status to the user**

Summarise what passed, flag that the migration must be applied to the hosted DB (external step), and ask whether to push + deploy.

---

## Notes for the implementer

- **Do not** add a streaming path — v1 is non-streaming by design (see spec §Decisions).
- **Do not** persist conversations — only `mentor_usage` is written.
- Keep the provider order Gemini→Groq in `mentorLLM`; do not reuse `callLLM` (that is Groq-first).
- The migration is not auto-applied; production chat will 500 on the rate-limit RPC until it is applied to the hosted DB.
