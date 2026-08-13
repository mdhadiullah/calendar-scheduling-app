# Deployment guide

## Part A — Supabase Cloud (production database/auth/storage)

1. Create a new project at [supabase.com](https://supabase.com) (separate from any local/dev project).
2. Push the schema: `supabase link --project-ref <your-project-ref>` then `supabase db push` (applies every file in `supabase/migrations/` in order). Alternatively, paste each migration file into the Supabase Studio SQL editor in numeric order (`0001_...` through `0008_...`).
3. Studio → Project Settings → API: copy the **Project URL**, **anon public key**, and **service_role key** (secret) — you'll need these for both `apps/api` and `apps/web` environment variables.
4. Studio → Authentication → Providers: keep Email enabled; disable public sign-ups (Authentication → Settings → "Allow new users to sign up" → off), since accounts are admin-provisioned only.
5. Studio → Authentication → URL Configuration: set **Site URL** to your production web app URL (e.g. `https://app.yourdomain.com`) and add `https://app.yourdomain.com/auth/set-password` to **Redirect URLs**.
6. Create your first production administrator the same way as local dev (§10 of the README), against the production project this time.

## Part B — Hostnin Node.js Hosting (Pro)

Hostnin's Node.js hosting is a managed, cPanel-style environment (no root/VPS access, no Docker). You get: an app root directory, a Node.js version selector, an environment-variable panel, GitHub/GitLab deploy, and (per the package spec) a cron/scheduled-task feature.

### B.1 — Deploy the API

1. In the Hostnin panel, create a **Node.js Application** (one of your two allowed apps):
   - **Application root**: e.g. `calendar-api`
   - **Application URL**: e.g. `api.yourdomain.com` (or `yourdomain.com/api` if you prefer a path)
   - **Node.js version**: 18, 20, or 22 LTS (match what you developed against)
   - **Application startup file**: `apps/api/dist/index.js`
2. Connect the GitHub repository and set the deploy branch (e.g. `main`). Set the **build command** Hostnin runs on deploy to:
   ```
   npm install && npm run build:shared && npm run build:api
   ```
   (If Hostnin's panel only allows a single "run npm install" toggle plus a custom script, add a `postinstall` script or use their "deploy script" hook to run `npm run build:shared && npm run build:api` after install.)
3. Set environment variables in Hostnin's panel (**do not** upload a `.env` file — use the panel's environment variable UI) using the same keys as `apps/api/.env.example`:
   ```
   NODE_ENV=production
   PORT=<leave to Hostnin — the app reads process.env.PORT automatically>
   APP_URL=https://app.yourdomain.com
   API_URL=https://api.yourdomain.com
   SUPABASE_URL=<production Supabase project URL>
   SUPABASE_ANON_KEY=<production anon key>
   SUPABASE_SERVICE_ROLE_KEY=<production service role key — SECRET>
   EMAIL_HOST=... EMAIL_PORT=... EMAIL_USER=... EMAIL_PASSWORD=... EMAIL_FROM=...
   TELEGRAM_BOT_TOKEN=<from @BotFather>
   TELEGRAM_BOT_USERNAME=YourCalendarAppBot
   CRON_SECRET=<openssl rand -hex 32>
   CORS_ORIGINS=https://app.yourdomain.com
   ```
4. Start (or restart) the application from the Hostnin panel. Confirm `https://api.yourdomain.com/health` returns `{"status":"ok"}`.

### B.2 — Deploy the web app

The web app is a static build (`apps/web/dist/`). Two supported options on Hostnin:

- **Option 1 (recommended, keeps things to one Node app): serve it from the API.** Add a static-file fallback to `apps/api` pointing at the built `apps/web/dist` folder and deploy both together as a single Hostnin Node.js Application. This uses only 1 of your 2 allowed apps, leaving the second free (e.g. for a staging environment).
- **Option 2: a second Hostnin Node.js Application** running a minimal static server (e.g. `serve apps/web/dist -l $PORT`) with its own subdomain. Simpler to reason about, costs your second app slot.

Either way, set `apps/web/.env.production` (or the equivalent build-time environment variables in Hostnin) before running `npm run build:web`:
```
VITE_SUPABASE_URL=<production Supabase project URL>
VITE_SUPABASE_ANON_KEY=<production anon key>
VITE_API_URL=https://api.yourdomain.com
```
These are public values baked into the static bundle at build time — that's expected and safe (RLS + the anon key's limited privileges are the real security boundary, not secrecy of the URL/anon key).

### B.3 — Wire up the scheduled jobs (no persistent worker required)

Hostnin Pro lists a cron/scheduled-task capability. Add cron entries that `curl` the job endpoints with the shared secret:

```
*/2 * * * *  curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://api.yourdomain.com/api/jobs/process-notifications
*/5 * * * *  curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://api.yourdomain.com/api/jobs/generate-reminders
0    *  * * *  curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://api.yourdomain.com/api/jobs/expire-trials
0    8  * * *  curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://api.yourdomain.com/api/jobs/trial-warnings
```

If your Hostnin plan's cron UI only allows a single scheduled task slot, use `run-all` on a 2–5 minute interval instead and run `expire-trials`/`trial-warnings` less frequently by checking a day-boundary inside the job (already handled for `trial-warnings` via its dedupe key; for a single-slot setup you can also fall back to an external free scheduler like [cron-job.org](https://cron-job.org) hitting the same secret-protected endpoints — it works identically since these are just authenticated HTTPS calls, not something that requires running on the host itself).

Every job endpoint is idempotent (unique `dedupe_key` on `notifications`, `expire_trials()` only touches rows still `TRIAL`), so overlapping or duplicate cron fires are safe.

### B.4 — Telegram webhook (one-time, after the API is live)

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.yourdomain.com/api/telegram/webhook"}'
```

### B.5 — Database migrations going forward

New migrations are plain SQL files in `supabase/migrations/`. Apply them to production the same way as initial setup: `supabase db push` against the production project ref, run as part of your deploy process (or manually, reviewed, before deploying API code that depends on the new schema).

## Part C — Desktop & Mobile releases

These are **not** deployed to Hostnin — they are built locally/via EAS and distributed directly to users (installers, or app store submissions). Point their production builds at the same `API_URL`/`SUPABASE_URL` as the web app:

- Desktop: `apps/desktop/README.md`
- Mobile: `apps/mobile/README.md`
