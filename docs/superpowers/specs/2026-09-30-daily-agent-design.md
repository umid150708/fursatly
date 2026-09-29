# Daily Fursatly agent

**Date:** 2026-09-30 · **Status:** approved by Umid (runs on his Mac)

## Why
On 29–30 Sep, several failures went unnoticed for weeks:
- Groq retired the model, and Vercel had no Gemini keys, so the mentor answered "busy" and nothing was ingested from 17 Aug to 29 Sep.
- The enrich queue starved.
- Paid adverts and duplicates went live.

Each was found only because Umid happened to look. A daily agent should find these, fix what it can without telling him, and message him only about what it can't fix.

## Shape
A Claude scheduled task on Umid's Mac (`fursatly-daily-agent`, 09:00 Europe/London). It runs when the Claude app is open, or at the next launch. Each run follows the runbook in the task prompt, working on three pieces:

1. **`GET /api/cron/health`** (CRON_SECRET, like the other crons) tests from inside production:
   - required env vars are present
   - every Gemini and Groq key answers a one-word prompt
   - the mentor answers a real prompt through `mentorLLM`
   - the database answers
   - the pipeline is fresh: newest listing under 72h old, and nothing waiting in the enrich queue longer than 26h

   Local probes can't see a key that is missing only in Vercel. This endpoint can.
2. **`scripts/watchdog.mjs`** writes one JSON report containing:
   - the health endpoint result
   - status codes for the key pages
   - the latest production deployment state
   - production error logs since the last reviewed run
   - every listing activated since then, with any paid-promotion marker
   - the duplicate replay over the live table, including suspects for a model check

   `--mark-reviewed` moves the cursor forward once the agent has handled the report. State and reports live in `~/.fursatly-watchdog/`.
3. **`scripts/notify-owner.mjs "<text>"`** sends Umid a Telegram message from @fusatlyuz_bot (`TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_CHAT_ID` in .env.local).

## Agent rules
- **Ads:** new listings are judged against the ad policy (admission campaigns, discounts called grants, paid courses/mentorship, pay-to-attend events, paid-placement markers). To take one down, set `is_active=false` and merge in `research_data.rejected='advertisement'`.
- **Duplicates:** retire with `research_data.duplicate_of` (`scripts/dedupe-events.mjs --apply` for deterministic matches; judge suspects itself).
- **Code or config errors:**
  1. Find the root cause first.
  2. Fix on a branch with a failing test.
  3. Run vitest, tsc and next build.
  4. Open a PR, merge it, wait for the production deploy.
  5. Re-run the health check.
- **Notify only** when something is still broken after trying, or needs Umid (billing, an expired key he must reissue, a decision). One short message.
- **Never:** hard-delete rows, post to the Telegram channel, change secrets beyond restoring ones that exist in .env.local, or merge with failing checks.

## Out of scope
Always-on alerting when the Mac is off. The site keeps working; the next run catches up.
