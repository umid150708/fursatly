# Fursatly daily agent — runbook

The scheduled task `fursatly-daily-agent` follows this every morning. Design: `docs/superpowers/specs/2026-09-30-daily-agent-design.md`.

**Umid's rule:** fix everything you can yourself, silently. Message him only about what you could not fix, or what only he can do. Keep it to 1–3 short lines, at most one message per run.

## Access (all on this Mac)
- Repo: `~/Desktop/Coding projects/Fursatly`. Secrets are in `.env.local`: Supabase URL and service key, CRON_SECRET, Gemini/Groq keys, TELEGRAM_BOT_TOKEN, OWNER_TELEGRAM_CHAT_ID.
- Vercel: `~/.local/bin/vercel` (logged in; add `--scope team_9PeOgM7qhYAYDQUICbchGVIr`). Project `prj_69Jx8MDClTLVwzaMxha7UyXQVfzZ`. Token in `~/Library/Application Support/com.vercel.cli/auth.json` for the REST API. Never print it.
- GitHub: `gh` (repo umid150708/fursatly). Pushing to `main` deploys production.
- Google Search Console: `node scripts/search-console.mjs status|submit|inspect <url>` acts as the service account `fursatly-seo@fursatly-search.iam.gserviceaccount.com` through gcloud impersonation (no key file).
- Crons by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://fursatly.uz/api/cron/<scrape|enrich|health>`. Put the secret in the header, never in the URL.

## 1. Report
```bash
cd ~/Desktop/Coding\ projects/Fursatly && git fetch -q && node scripts/watchdog.mjs
```
Read `issues` first, then the details. The report is also saved in `~/.fursatly-watchdog/reports/`.

## 2. Handle each issue

**Health check failed.** Re-run `curl …/api/cron/health` once, since spikes pass. If it still fails:
- A key or model answers 404 "model not found / no longer available": the provider retired the model.
  1. List the models the key can use (Groq `GET /openai/v1/models`, Gemini `GET /v1beta/models`).
  2. Benchmark two or three candidates with the real prompts, including an 8-token answer.
  3. Switch the constant in `src/pipeline/groq.ts` / `scripts/lib/groq.mjs` or `src/pipeline/gemini.ts` via the code-fix protocol. History: llama-3.3 → qwen3.8-27b, gemini-2.5 → 3.5 → 3.6.
- "slow": benchmark the same way and switch if a model is clearly faster on every key.
- 401/403 or "API key invalid/expired" on one key while the others work: you can't fix this. Tell Umid which key to reissue (Google AI Studio or console.groq.com).
- `env` lists something missing: if the value exists in `.env.local`, restore it with `POST /v10/projects/{id}/env?teamId=…&upsert=true` (type `sensitive`, target `production`). Then run `vercel redeploy <prod url> --target production --scope …`. Otherwise tell Umid.
- pipeline: "no new listing for Nh" or "queued for Nh":
  1. Run scrape, then enrich, by hand.
  2. Read their JSON results.
  3. Read `vercel logs --environment production --since 24h --scope …`.
  4. Find the cause and fix it via the code-fix protocol.

**Page not 200, deployment not READY, or production errors.** Read the logs, reproduce locally (`npm run dev`, port 9002), find the root cause, then use the code-fix protocol. A failed deployment: `vercel inspect <url> --logs --scope …`.

**New listings.** Read every one. Take it down when it is advertising rather than an opportunity:
- an admission campaign or open day of one institution
- a tuition discount called a grant ("20% grant for all applicants")
- paid courses, SAT/IELTS prep, paid mentorship or consulting
- a pay-to-attend summit, forum or trip ("travel scholarship" discounts)
- a channel or webinar promo
- a paid-placement link (utm …paid/cpc, gclid)

Keep genuine programmes even if they charge fees (LaunchX, Wolfram, Babson).
```bash
node scripts/take-down.mjs --ad <id>      # add --dry-run first if unsure
```
If an ad got through because of a gap in `src/pipeline/promo.mjs` or the prompts (`src/ai/flows/extract-event-details-flow.ts`, `src/pipeline/prompts.mjs`), close the gap with the code-fix protocol.

**Duplicates.** Sure matches: run `node scripts/dedupe-events.mjs` (dry run), then `--apply`. For each suspect pair, read both listings.
- Same listing: `node scripts/take-down.mjs --duplicate-of <keepId> <dropId>`. Keep the older one, since Telegram links point at it.
- Different: `node scripts/watchdog.mjs --not-duplicate <idA> <idB>`.

If a real duplicate slipped past, add its pattern to `src/pipeline/dedupe.mjs` with a test.

## 3. Code-fix protocol
1. Work in your own worktree, so other sessions keep theirs:
   ```bash
   git worktree add ../fursatly-agent-$(date +%F) -b agent/<topic> origin/main
   ```
   Copy `.env.local` in if you need to run anything, then `npm ci`.
2. Find the root cause before changing anything.
3. Write a failing test in `tests/`, then fix it.
4. Check: `npx vitest run tests/`, `npx tsc --noEmit -p .`, `npx next build`. All must pass.
5. Commit with a message saying why, ending with the Co-Authored-By line. Then `git push -u origin HEAD`, `gh pr create`, and `gh pr merge --merge`.
6. Wait for the production deployment of the merge commit (GitHub deployments API, `environment=Production`) to reach `success`.
7. Re-run the health check and watchdog to confirm the fix.
8. Remove the worktree.

If the checks still fail after two honest attempts, don't merge. Tell Umid what broke and link the branch.

## 4. Finish
- `node scripts/indexnow.mjs` pushes pages changed in the last 2 days to Bing and Yandex. Weekly (Mondays), also run `node scripts/search-console.mjs status`: if the sitemap shows errors or the homepage reads anything other than indexed after mid-October 2026, find out why.
- `node scripts/watchdog.mjs --mark-reviewed`, but only after every new listing and suspect was handled.
- Append one line to `~/.fursatly-watchdog/log.md`: `YYYY-MM-DD — found … — fixed … — notified: yes/no`.
- Only if something is still wrong or needs Umid: `node scripts/notify-owner.mjs "<1–3 short lines: what's wrong, what you tried, what he must do>"`.

## Never
- Hard-delete rows, post to the Fursatly Telegram channel, or run the broadcast cron.
- Force-push, merge with failing checks, or edit other repos.
- Change secrets other than restoring one that exists in `.env.local`.
- Message Umid about things you fixed.
