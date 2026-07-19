# Telegram Connect + Save-to-Remind + Chat UI Polish — Plan

**Goal:** (1) a Telegram connect flow that always shows a real button, (2) a
"save → get reminded on Telegram" concept on event pages, (3) a redesigned
mentor chat panel, (4) visible scroll affordances site-wide.

## Why the current connect is broken

The account card renders Telegram's **login widget** — an iframe injected by a
remote `telegram.org` script. If `/setdomain` doesn't exactly match the host,
or an ad-blocker eats the script, it renders **nothing** (exactly what the
user's screenshot shows). Invisible-on-failure is unacceptable for the one
button that powers reminders.

## Concept: deep-link connect (reliable, mobile-first)

```
[Connect Telegram] button (ours, always visible)
   → GET /api/telegram/connect-link  (auth-gated)
   → returns https://t.me/<bot>?start=<signed-token>
   → user taps "Start" in Telegram (app or web)
   → Telegram POSTs /start <token> to /api/telegram/webhook
   → webhook verifies HMAC token → writes telegram_chat_id to the profile
   → bot DMs "✅ Connected — reminders will arrive here"
   → account page refetches profile on window focus → shows Connected
```

- **Token:** stateless HMAC (no table): `<uuid-hex32>_<exp>_<sig>` signed with
  `TELEGRAM_WEBHOOK_SECRET`, 15-min expiry, ≤64 chars (Telegram start-payload
  limit). Pure lib `src/lib/connect-token.ts` + vitest.
- **Webhook:** extend existing `/api/telegram/webhook` — `/start <token>` in a
  private chat handles connect BEFORE the ingestion path; everything else
  behaves as before. Confirmation DM localised via `message.from.language_code`.
- The old login widget stays on `/auth` (login is a different flow); the
  account card switches to the deep-link button.

## Save-to-remind on event pages

New `TelegramRemindHint` under the event page SaveButton (signed-in only):
- saved + TG not connected → nudge card: bell icon, "Get deadline reminders on
  Telegram", Connect button (same deep-link).
- saved + connected → quiet confirmation line: "We'll message you 3 days and
  1 day before the deadline." (the existing cron already does this — the
  feature was invisible; this makes it a promise).

## Mentor chat redesign (ui-ux-pro-max)

Header: hue-tinted icon chip, title + "online" status dot, close button ≥44px.
Messages: avatar chip for the mentor, roomier bubbles (rounded-2xl, max-w 85%),
animated three-dot typing indicator, `aria-live="polite"` log. Scroll: **visible
thin scrollbar** (`.scrollbar-thin` utility), auto-scroll to newest. Input:
autofocus on open, Esc closes, send ≥44px. Mobile: full-width sheet
(`inset-x-4`), `max-h` dvh-aware. Motion: fade/slide entrance ≤250ms, disabled
under `prefers-reduced-motion`.

## Scroll affordances

- `.scrollbar-thin` utility in globals.css (webkit + Firefox), used by the chat
  and the homepage "closing soon" horizontal rail (was `no-scrollbar` — users
  couldn't tell it scrolls).
- New global `BackToTop` (bottom-left, appears after 600px, smooth-scroll,
  respects reduced motion) mounted in the root layout — fixes "no way back up"
  on the long homepage/event/account pages.

## Dependency flag

Telegram's webhook POSTs are server-to-server — **Vercel Attack Challenge Mode
must stay OFF** or Telegram gets 403-challenged and connect DMs never arrive.
(Same reason users saw the checkpoint page.) Webhook is registered via
`setWebhook` with the `TELEGRAM_WEBHOOK_SECRET` secret-token guard.

## Tasks

1. `connect-token.ts` + tests (TDD)
2. `GET /api/telegram/connect-link` (auth-gated)
3. Webhook `/start` handling + localized confirmation DM
4. Account card → deep-link button + focus-refetch
5. `TelegramRemindHint` on event page
6. MentorPanel redesign + `.scrollbar-thin` + BackToTop + rail scrollbar
7. Translations EN/UZ/RU
8. Tests/typecheck/build; browser verification (signed-in states via injected
   session on localhost); simulate webhook POST; setWebhook; deploy; prod check
