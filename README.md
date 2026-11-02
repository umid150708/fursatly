# Fursatly

AI-curated opportunities for students — scholarships, competitions, summer programs, fellowships and internships. Fursatly started for Uzbek students and is open to everyone. The interface is in Uzbek, English and Russian, and every listing is translated into Uzbek and Russian.

Built with Next.js 15 (App Router), Supabase, Groq and Gemini.

🌐 Live: [fursatly.uz](https://fursatly.uz)
📣 Telegram channel: [@fursatly](https://t.me/fursatly) — new opportunities in Uzbek and English

## What it does

- **Scrapes** a rotating set of Telegram channels daily for new opportunities
- **AI-filters** ads, channel promos and informational roundups
- **Extracts** structured data (title, deadline, location, age range, apply URL)
- **Enriches** each opportunity with eligibility, tips and resources (Qwen 3.8 27B on Groq, Gemini as fallback)
- **Translates** every opportunity into Uzbek and Russian
- **Removes** listings the moment their deadline passes (rolling listings with no deadline stay)
- **Accounts** with email and password, magic link, Google or Telegram sign-in
- **Saved opportunities and reminders** — Telegram DM 3 days and 1 day before a saved deadline
- **AI mentor** on each opportunity page for signed-in users (30 messages a day)
- **Telegram channel** — up to 5 new opportunities a day, plus a weekly "closing this week" roundup
- **Multilingual UI** — English (default for every visitor), Uzbek (Latin) and Russian

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Telegram       │    │  Vercel          │    │  Supabase       │
│  channels       │───▶│  /api/cron/*     │───▶│  events table   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Groq            │
                       │  Qwen 3.8 27B    │  Gemini fallback
                       └──────────────────┘
```

| Component | Tech |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| Database | Supabase Postgres (with `pg_cron` for expiry) |
| Hosting | Vercel |
| Extraction and enrichment | Groq `qwen/qwen3.8-27b`, 6-key rotation; Gemini `gemini-3.6-flash` as fallback |
| Mentor chat | Gemini first, Groq as fallback |
| Scheduling | Vercel crons, cron-job.org (every 10 min for enrichment), per-minute `pg_cron` job for expiry |

## Cron schedule

| Path | Frequency | What it does |
|---|---|---|
| `/api/cron/scrape` | Daily 02:00 UTC | Pulls last 24h of posts from a rotating set of Telegram channels (day-rotated, per-channel capped) |
| `/api/cron/cleanup` | Daily 03:00 UTC | Backstop: removes inactive expired listings |
| `/api/cron/enrich` | Daily 04:00 UTC (+ every 10 min via cron-job.org) | Enriches queued events |
| `/api/cron/enrich-backfill` | Daily 04:30 UTC | Backfills missing translations and slugs |
| `/api/cron/reminders` | Daily 05:00 UTC | DMs saved-event deadline reminders (3 days and 1 day before) |
| `/api/cron/broadcast` | Daily 06:00 UTC | Posts up to 5 new opportunities to the Telegram channel (`TELEGRAM_CHANNEL`), in Uzbek and English |
| `/api/cron/digest` | Mon 07:00 UTC | Posts a weekly "closing this week" roundup to the Telegram channel |
| Supabase `pg_cron` | Every minute | Deletes events as soon as their deadline passes |

All cron routes require `?secret=<CRON_SECRET>` query param or `Authorization: Bearer <CRON_SECRET>` header.

The per-minute expiry job lives in `supabase/migrations/`. That folder is gitignored and the SQL is applied by hand in the Supabase SQL Editor, so a deploy does not run it.

## Environment variables

Set these in Vercel and locally in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

GROQ_KEY_1=...
  ...
GROQ_KEY_6=...

GEMINI_API_KEY=...
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
GEMINI_API_KEY_4=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
NEXT_PUBLIC_TELEGRAM_BOT=fusatlyuz_bot   # bot username, no @
TELEGRAM_CHANNEL=@fursatly               # optional, this is the default

CRON_SECRET=...
```

Never commit `.env.local` — it's gitignored.

## Local development

```bash
npm install
npm run dev        # http://localhost:9002
npm test           # vitest
npm run typecheck
```

## Deploy

Push to `main` → Vercel rebuilds automatically. Zero-downtime atomic swap. Rollback any time from the Vercel dashboard.
