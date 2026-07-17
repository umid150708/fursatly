# Accounts + Saved Opportunities — Design

**Date:** 2026-07-17 · **Status:** Approved (user waived checkpoint-2 review; will judge live after build)

## Goal

Let students create an account, bookmark opportunities, manage a light profile, and get
Telegram DM reminders before saved deadlines. Foundation for the next cycle's AI chatbot
(which needs server-readable identity).

## Scope

- **Auth methods (all four):** email magic link, Google OAuth, email + password, Telegram login.
- **Profile:** display name + avatar auto-seeded from provider; optional age, country,
  interests; `reminders_enabled` toggle. Editable on `/account`.
- **Saved opps:** save/unsave from event cards and the event detail page; list shown on
  `/account` alongside profile settings.
- **Reminders:** Telegram DM (existing bot) at 3 days and 1 day before a saved opportunity's
  deadline. Only for users with a connected Telegram chat id and `reminders_enabled`.
- **Out of scope:** email reminders, chatbot, full onboarding flow.

## Architecture (approved: "cookie foundation, client ergonomics")

- `@supabase/ssr` cookie sessions (new dependency). `middleware.ts` refreshes the session.
- `src/supabase/client.ts` swaps the singleton to `createBrowserClient`; all ~15 call sites
  keep using `useDb()` unchanged. New `src/supabase/server.ts` for server components/routes.
- Client `AuthProvider` context exposes `user`, `session`, `signOut`, sign-in methods.
- `/account` is a thin server component: reads user from cookies, redirects to `/auth` if
  signed out, renders client UI. Homepage/event pages stay client-rendered.
- Telegram login: widget → `/api/auth/telegram` verifies HMAC (key = SHA256 of bot token),
  upserts a user (synthetic email `tg-<id>@telegram.fursatly.uz`), mints a session via
  admin `generateLink` → client `verifyOtp`. Stores `telegram_chat_id` on the profile.

## Data model

- `profiles` — PK `id` → `auth.users` cascade; `display_name`, `avatar_url`, `age` (10–100),
  `country`, `interests text[]`, `telegram_chat_id bigint unique`, `telegram_username`,
  `reminders_enabled bool default true`, `updated_at`. Auto-created by `handle_new_user`
  trigger on `auth.users`.
- `saved_opportunities` — `id`, `user_id` → users cascade, `event_id` → events cascade,
  `unique(user_id, event_id)`, `created_at`.
- `reminders_sent` — idempotency ledger: `saved_opportunity_id` cascade, `offset_label`
  ('3d' | '1d'), `sent_at`, `unique(saved_opportunity_id, offset_label)`.

### RLS

- `profiles`: owner-only select/insert/update (`auth.uid() = id`). Not public.
- `saved_opportunities`: owner-only select/insert/delete (`auth.uid() = user_id`).
- `reminders_sent`: RLS on, **no policies** — service-role cron only.
- `events`: unchanged.

Verified at migration time: `events.id` type (assumed uuid); cleanup cron's hard-delete
cascades saved rows — intended (reminders fire before deadlines).

## Surfaces

- `/auth` — sign-in/up page: password form, magic-link button, Google button, Telegram
  login widget. Trilingual via existing `translations.ts`.
- `/auth/callback` — route handler, `exchangeCodeForSession` for OAuth/magic-link.
- `/account` — server-gated; profile form (name, age, country, interests, reminders toggle),
  Telegram connect status, saved-opportunities grid (reuses `EventCard`), sign out.
- `SaveButton` — bookmark toggle overlaid on `EventCard` (card itself is a `<button>`, so
  the control is absolutely positioned, not nested) + on the event detail page. Signed-out
  click → routes to `/auth`.
- `SiteNav` — account entry point next to theme/language controls (avatar when signed in).

## Reminders cron

`/api/cron/reminders` (daily, Vercel cron, CRON_SECRET-guarded): service-role query joins
saved_opportunities × events (deadline in next 3d/1d windows) × profiles
(telegram_chat_id set, reminders_enabled) minus reminders_sent; DMs via
`TELEGRAM_BOT_TOKEN`; records each send. Trilingual message per user's saved language —
falls back to UZ.

## Error handling

- Auth errors surface inline on `/auth` (translated, not toasts-only).
- Telegram hash mismatch / stale auth_date (>1h) → 401, no session.
- Save/unsave is optimistic with rollback + toast on failure.
- Cron: per-user try/catch — one blocked bot must not stop the batch; 1.5s gap between DMs
  (matches broadcast route's rate-limit pattern).

## Testing

- Vitest: Telegram hash verify (valid/invalid/stale), reminder window selection + dedupe
  logic (pure functions extracted for testability).
- `npm run typecheck` + `npm run build` green.
- Live browser pass: sign-in flows, save/unsave, account page, RLS negative check
  (user A cannot read user B's saves via anon key).

## External setup (user/dashboard, not code)

1. Run migration SQL (Supabase SQL editor or `supabase login` + `db push`).
2. Enable Google provider in Supabase Auth settings (OAuth client id/secret).
3. Set Site URL + redirect URLs (`https://fursatly.uz/auth/callback`, localhost:9002).
4. BotFather `/setdomain` for the login widget on fursatly.uz; add `TELEGRAM_BOT_TOKEN`
   to `.env.local` for local testing.
5. Add `/api/cron/reminders` to vercel.json crons (in code) — no dashboard step.
