# Fursatly

AI-powered opportunity platform for Central Asian students — scholarships, competitions, summer programs, fellowships, internships. Built with Next.js 15 (App Router), Supabase, and Groq.

🌐 Live: [fursatly.uz](https://fursatly.uz) (production)

## What it does

- **Scrapes** a rotating set of Uzbek Telegram channels daily for new opportunities
- **AI-filters** ads, channel-promos, and informational roundups
- **Extracts** structured data (title, deadline, location, age range, apply URL)
- **Enriches** each opportunity with eligibility, tips, and resources via Llama-3.3-70B on Groq
- **Translates** every event to Uzbek + Russian automatically
- **Deletes** events past their deadline daily
- **Multilingual UI** — English, Uzbek (Latin), Russian

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
                       │  Llama 3.3 70B   │
                       └──────────────────┘
```

| Component | Tech |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| Database | Supabase Postgres |
| Hosting | Vercel (Hobby tier) |
| AI | Groq — `llama-3.3-70b-versatile`, 6-key rotation |
| Cron triggers | cron-job.org (every 10 min) + Vercel daily crons |

## Cron schedule

| Path | Frequency | What it does |
|---|---|---|
| `/api/cron/scrape` | Daily 02:00 UTC | Pulls last 24h of posts from a rotating set of Telegram channels (day-rotated, per-channel capped) |
| `/api/cron/cleanup` | Daily 03:00 UTC | Hard-deletes events past their deadline |
| `/api/cron/enrich` | Daily 04:00 UTC (+ every 10 min via cron-job.org) | Enriches queued events |
| `/api/cron/enrich-backfill` | Daily 04:30 UTC | Backfills missing translations/slugs |
| `/api/cron/reminders` | Daily 05:00 UTC | DMs saved-event deadline reminders (3d/1d) |
| `/api/cron/broadcast` | Daily 06:00 UTC | Posts up to 5 new opportunities to the public TG channel (`TELEGRAM_CHANNEL`) |
| `/api/cron/digest` | Mon 07:00 UTC | Posts a weekly "closing this week" roundup to the TG channel |

All cron routes require `?secret=<CRON_SECRET>` query param or `Authorization: Bearer <CRON_SECRET>` header.

## Environment variables

Set these in Vercel and locally in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

GROQ_KEY_1=...
GROQ_KEY_2=...
GROQ_KEY_3=...
GROQ_KEY_4=...
GROQ_KEY_5=...
GROQ_KEY_6=...

CRON_SECRET=...
```

Never commit `.env.local` — it's gitignored.

## Local development

```bash
npm install
npm run dev        # http://localhost:9002
```

## Deploy

Push to `main` → Vercel rebuilds automatically. Zero-downtime atomic swap. Rollback any time from the Vercel dashboard.
