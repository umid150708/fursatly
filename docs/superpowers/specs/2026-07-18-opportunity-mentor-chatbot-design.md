# Opportunity Mentor Chatbot — Design

## Goal

Add an AI **mentor** to every opportunity page (`/event/[id]`). A signed-in
student opens a chat panel and gets personalised guidance about studying abroad,
opportunities, and careers — anchored to the opportunity they're viewing, and
aware of their own profile. Free to run (reuses the existing Groq/Gemini infra),
zero new conversation storage.

## Decisions (from brainstorming, 2026-07-18)

| Question | Decision |
| --- | --- |
| Purpose | **General mentor/advisor**, entered from an opportunity (the opportunity is the starting context, not a hard boundary). |
| Access | **Signed-in only, personalised.** The mentor reads the caller's profile (age, country, interests, saved-count). |
| Model | **Reuse free `callLLM()` infra**, but inverted to prefer **Gemini** (better Uzbek; avoids contending with the Groq-heavy enrichment cron). |
| Memory | **Ephemeral.** Conversation lives in React state for the page visit; nothing is stored. |
| Abuse control | **Yes** — a tiny `mentor_usage` daily counter caps messages/user/day. |
| Streaming | **No (v1).** Non-streaming reply + typing indicator. Streaming is a fast-follow. |

## Scope

**In:** floating mentor panel on `/event/[id]`; `POST /api/mentor/chat` route
(auth-gated, profile + opportunity grounded); `mentorLLM()` provider wrapper;
`mentor_usage` rate-limit ledger + `bump_mentor_usage` RPC; trilingual UI
(EN/UZ/RU); prompt-builder unit tests.

**Out (later):** streaming responses; stored conversation history; a global
cross-opportunity mentor thread; anonymous/guest access.

## Architecture (approved: "stateless route + client-held conversation")

```
/event/[id]  ─ MentorPanel (client, React state holds messages[]) ─┐
                                                                    │ POST { eventId, messages, locale }
                                                                    ▼
                                        /api/mentor/chat (route handler)
                                          1. createServerSupabase() → require session (else 401)
                                          2. bump_mentor_usage(uid) → 429 if over daily cap
                                          3. load event.research_data (service role) + profile (RLS, own row)
                                          4. buildMentorPrompt(...) → single flattened string
                                          5. mentorLLM(prompt) → Gemini-first, Groq fallback
                                          6. return { reply }
```

The conversation is never persisted. Each turn the client re-sends the trimmed
transcript, so the route stays stateless. `callLLM()` already accepts a single
prompt string, so `buildMentorPrompt` flattens system + history + latest turn
into one string — **no change to the LLM client is required.**

## Data model

One new table — a **rate-limit ledger, not chat history**:

```sql
create table if not exists public.mentor_usage (
  user_id uuid  not null references auth.users(id) on delete cascade,
  day     date  not null default current_date,
  count   int   not null default 0,
  primary key (user_id, day)
);
alter table public.mentor_usage enable row level security;
-- No policies → only the service role (used by the route) can read/write it.
```

Atomic increment via RPC (avoids read-then-write races):

```sql
-- NOT security definer: runs with the caller's rights. The route calls it via
-- the service-role client (bypasses RLS → works). A direct call by an
-- authenticated user runs as invoker, hits the no-policy RLS, and fails — so no
-- one can inflate another user's counter.
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

**Daily cap:** `MENTOR_DAILY_LIMIT = 30` messages/user/day. The route calls
`bump_mentor_usage` first; if the returned count exceeds the cap, it returns
`429` with a translated "come back tomorrow" message and does **not** call the
model.

## Components

- **`src/lib/mentor-prompt.ts`** (pure, tested) — `buildMentorPrompt({ event, profile, messages, locale })` → string. Composes: mentor persona → this opportunity's facts (title, deadline, eligibility, benefits, organisation, official link) pulled from `research_data` → the student's profile → guardrails → the trimmed transcript. `trimHistory(messages, maxTurns = 8)` keeps the last N turns.
- **`src/pipeline/mentor-llm.ts`** — `mentorLLM(prompt, maxTokens?)`: tries `gemini.call()` first, falls back to `groq.call()`. Reuses the existing `gemini`/`groq` singletons (DRY). Inverse of `callLLM`'s order.
- **`src/app/api/mentor/chat/route.ts`** — the route handler above. Uses the cookie-scoped client to identify the user + read their profile (RLS), and a service-role client for `research_data` + `bump_mentor_usage`.
- **`src/components/mentor/MentorPanel.tsx`** (client) — floating bubble → expandable chat panel on the opportunity page. Holds `messages` in state; posts each turn; shows typing indicator; renders errors (rate-limit, network) inline. Signed-out tap → route to `/auth?next=/event/<id>` (mirrors `SaveButton`).
- **Wiring** — mount `MentorPanel` in `src/app/event/[id]/page.tsx`; add EN/UZ/RU strings to `src/lib/translations.ts`.

## Guardrails (system prompt)

- Persona: a warm, practical mentor for Central Asian students.
- Stay in-lane: education, opportunities, studying abroad, careers. Politely
  redirect clearly off-topic requests back to what the mentor can help with.
- Ground opportunity-specific claims in the provided `research_data`. **Never
  invent deadlines, eligibility rules, or links.** If a fact isn't in the data,
  say so and point to the official website.
- Admit uncertainty rather than guessing.
- Respond in the language named by `locale` (en/uz/ru).
- Keep answers concise and actionable.

## Data flow / error handling

- **Not signed in** → route returns `401`; panel routes the user to `/auth`.
- **Over daily cap** → `429` + translated notice; panel shows it inline, disables input until tomorrow.
- **Both providers throttled** → `mentorLLM` throws; route returns `503`; panel shows a "mentor is busy, try again" retry message.
- **Malformed request** (missing eventId / empty messages) → `400`.
- No PII leaves the system beyond what's already in the user's own profile; the
  service-role client is server-only.

## Testing

- **`tests/mentor-prompt.test.ts`** (vitest, pure): prompt includes the
  opportunity's grounded facts; includes profile fields when present and degrades
  gracefully when null; `trimHistory` keeps the last 8 turns; the requested
  `locale` appears in the language instruction; guardrail lines present.
- Typecheck + `npm run build` green; existing 70 tests stay green.
- Manual: signed-out tap → `/auth`; signed-in chat answers grounded questions;
  31st message in a day is refused.

## External setup (user/dashboard, not code)

- Apply the migration (`mentor_usage` table + `bump_mentor_usage` RPC) to the
  hosted DB — same flow as the accounts migration.
- No new API keys: reuses existing `GEMINI_API_KEY_*` / `GROQ_KEY_*`.
