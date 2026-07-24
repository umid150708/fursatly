# Session Handoff — 2026-07-20

Continuation notes for the next working session on **Fursatly** (fursatly.uz —
AI-curated opportunities platform for Central Asian students). Everything below
is live on production unless marked otherwise.

## Where things stand

**All shipped, verified, and deployed on `main`.** Working tree is clean; every
commit is pushed and git auto-deploy has published them. 103 vitest tests green,
typecheck + build green.

## What shipped recently (newest first)

| Commit | What |
| --- | --- |
| `dee3a52` | Smooth day/night toggle: pause Lenis + hide/skip WebGL hero during the View-Transition reveal (`vt-start`/`vt-end` events); 950→650ms |
| `e8f3776` | **Auth fix:** middleware 308-redirects `www.fursatly.uz` → apex. Sessions were stranded per-host (Google OAuth landed on www, apex looked logged out) |
| `5b493cd` | **Clean URLs:** `/event/<slug>` (e.g. `wise-up-fergana-2026`) instead of raw UUIDs |
| `f1493a2` | Why-Fursatly drawing: stage keywords curve along their own rings (textPath) |
| `ca2de4e` | @types/node ^20.19 (silences Vercel peer-dep warning) |
| `4122f44` | Mentor chat redesign + `.scrollbar-thin` + BackToTop (bottom-left, Lenis-aware) |
| `ceb8bd5` | **Telegram connect deep link** + save-to-remind hint on event pages |
| `07b7ee4` | Homepage ISR: data baked into HTML, events payload 825→70 KB (−92%) |
| earlier | AI mentor chatbot (Gemini-first, rate-limited 30/day via `mentor_usage`), accounts + saved + reminders feature, /auth page, age-input fix, back-link on /auth |

## Feature map (all live)

- **Accounts:** email+password, magic link, Google OAuth, Telegram login widget
  (on /auth). Cookie sessions via `@supabase/ssr`; middleware refreshes + gates
  `/account` and canonicalizes host to apex.
- **Saved opportunities + reminders:** SaveButton everywhere; cron
  `/api/cron/reminders` DMs 3d/1d before deadlines (dedup ledger
  `reminders_sent`). Save→remind nudge on event pages (`TelegramRemindHint`).
- **Telegram connect (reliable path):** `TelegramConnectButton` →
  `GET /api/telegram/connect-link` → `t.me/fusatlyuz_bot?start=<HMAC token>`
  (`src/lib/connect-token.ts`, stateless, 15-min TTL) → webhook
  `/api/telegram/webhook` handles `/start <token>` in private chats, links
  `profiles.telegram_chat_id`, sends localized confirmation DM. Webhook IS
  registered with secret-token guard (`getWebhookInfo` healthy).
- **AI mentor:** floating panel on `/event/[id]` (signed-in only, personalised,
  ephemeral convo). `POST /api/mentor/chat` → `buildMentorPrompt`
  (`src/lib/mentor-prompt.ts`) → `mentorLLM` (`src/pipeline/mentor-llm.ts`,
  Gemini-first, Groq fallback). Daily cap 30 via `bump_mentor_usage` RPC.
- **Clean URLs:** slugs live in `research_data.slug`. `src/lib/slug.ts`
  (slugify + Cyrillic translit, tested), `src/lib/event-path.ts`
  (`eventSlug()`, `isUuid()`). Event page resolves slug-or-UUID and upgrades
  the address bar via `history.replaceState`. Enrich pipeline auto-slugs new
  events (verified end-to-end with a real LLM run). All 121 existing events
  backfilled (`scripts/backfill-slugs.mjs`, idempotent). Reminder/broadcast
  DMs + all internal links use slugs.
- **Perf:** homepage is ISR (revalidate 300) — server `page.tsx` seeds
  `HomeClient` via `EVENT_LIST_SELECT`/`mapEventListRow`
  (`src/lib/event-list.ts`, JSON-path trimmed select). `useCollection` accepts
  `initialData` and skips the redundant first fetch.

## Pending — user actions (Umid)

1. **Supabase Site URL** is still `https://www.fursatly.uz` → works (middleware
   redirects, OAuth `?code=` survives the hop) but adds one extra redirect on
   Google sign-in. Tidy-up: Supabase → Auth → URL Configuration → Site URL →
   `https://fursatly.uz`.
2. **Vercel CLI token expired** — every `npx vercel` call 403s. Run
   `npx vercel login` to restore programmatic Vercel access for the agent.
   (Deploys are unaffected — git push auto-deploys.)
3. **Personal E2E tests** never done by a human: Google sign-in full
   round-trip, and the real Telegram connect tap (agent verified via simulated
   webhook POSTs + throwaway users only).

## Gotchas / tribal knowledge

- **React 19 prod hydration strips `<html>` attributes it didn't render** —
  dev hydration doesn't. Any pre-paint probe writing to `documentElement`
  (theme class, `data-motion`) MUST be re-asserted in a client effect after
  mount (ThemeContext and MotionConfig both do this now). This once silently
  killed the entire animation tier on prod only: frozen floating cards,
  pre-drawn Why-Fursatly diagram, no Lenis — while localhost looked perfect.

- **Vercel Attack Challenge Mode** was ON earlier (served "Vercel Security
  Checkpoint" to visitors AND 403'd Telegram webhooks + all curl). It is OFF
  now. If the checkpoint page reappears: Vercel → fursatly → Firewall.
- **Migrations are gitignored** (`supabase/migrations/`) and applied manually
  via the Supabase SQL Editor (no DB connection string available). Applied so
  far: accounts tables + `mentor_usage` + `bump_mentor_usage` (NOT security
  definer — service-role only by RLS-no-policy design).
- **Two dev-server configs** in `.claude/launch.json`: `fursatly-dev` (9002)
  and `fursatly-dev-9102` (9102, turbopack). Running two servers on one
  `.next` corrupts the build cache (ENOENT manifests) → run one, or
  `rm -rf .next`.
- **Lenis owns scrolling** on motion-tier devices (`window.lenis` exposed).
  Programmatic scrolls must go through it; `BackToTop` already does.
- **Agent browser pane** suspends rAF/rendering when not foregrounded — GSAP
  timelines, View Transitions, and scroll-reveals stay frozen there. Verify
  via DOM/JS assertions, force `[data-anim]/[data-reveal]` states, or
  screenshot (forces one paint). Desktop-only SVG needs viewport ≥1024
  (`resize_window` width 1280).
- **Telegram login widget** renders nothing when blocked — that's why the
  account card uses the deep-link button instead. Widget remains only on
  `/auth` for login.
- **LLM infra:** Groq (6 keys, llama-3.3-70b) + Gemini (3 keys, 2.5-flash) —
  `callLLM` is Groq-first (pipeline), `mentorLLM` is Gemini-first (chat,
  better Uzbek). All free tier.
- Env lives in `.env.local` (bot token, webhook secret, CRON_SECRET, service
  role key, Groq/Gemini keys). Same vars mirrored in Vercel project env.

## Next-step candidates (not started)

- Set Supabase Site URL (above), then remove the note from this file.
- Human E2E pass on auth + TG connect (above).
- Possible fast-follows discussed: streaming mentor replies (SSE), stored
  mentor conversations, per-event reminder offsets, guest mentor access.
- SEO follow-up for slugs: `generateMetadata` on `/event/[id]` (title/OG per
  event) would make the clean URLs actually pay off in link previews.

## Verification habits that worked here

TDD for pure libs (`tests/*.test.ts`, vitest, 103 passing) · real-path E2E with
throwaway users/events against prod DB (always cleaned up + secrets scrubbed) ·
browser verification via injected `@supabase/ssr` session cookie on localhost ·
`curl` probes for edge behavior (redirects, headers, webhook reachability).
