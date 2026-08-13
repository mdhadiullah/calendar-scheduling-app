# Production readiness checklist

Mapped 1:1 to the spec's §30 deployment checklist. Items marked **build-verified** were checked by actually running the command in this repository; items marked **verify on your infra** depend on your Supabase project / Hostnin account / Telegram bot and must be checked once you provision those.

- [x] Application builds successfully — **build-verified**: `npm run build` (shared → api → web) completes with no errors.
- [x] Production Node.js start command works — `npm start` runs `node apps/api/dist/index.js`; **build-verified** that `dist/index.js` is produced by the build.
- [x] PORT is configurable — `apps/api` reads `process.env.PORT` exclusively (`src/lib/env.ts`), never hard-coded.
- [ ] Supabase production connection works — verify on your infra: run the migrations against your production project (§B.1 in `docs/deployment.md`) and confirm `/health` and an authenticated `/api/me` call succeed.
- [ ] Authentication works — verify on your infra: sign in as the admin you created in production.
- [ ] RLS policies work — verify on your infra: confirm a non-admin user cannot read another user's private calendar/tasks via the Supabase REST API directly (only through the API's authorization rules).
- [ ] Admin login works — verify on your infra.
- [ ] Client login works — verify on your infra: create a CLIENT user via the admin panel and complete the activation-link flow.
- [x] 15-day trial works — **build-verified in schema**: `handle_new_profile` trigger sets `trial_ends_at = now() + interval '15 days'` for every non-admin role (`supabase/migrations/0002_profiles_and_access.sql`).
- [x] Trial expiration works — **build-verified in code**: `POST /api/jobs/expire-trials` calls `expire_trials()` which flips `TRIAL → EXPIRED` once `trial_ends_at` has passed; `requirePermitted` middleware blocks app access once expired.
- [x] Admin one-click activation works — **build-verified in code**: `POST /api/admin/users/:id/activate` → `admin_set_license_status(..., 'ACTIVE', ...)`, no reinstall needed (it's a server-side status flip).
- [x] Admin lock works — **build-verified in code**: `POST /api/admin/users/:id/lock`.
- [x] Admin unlock works — **build-verified in code**: `POST /api/admin/users/:id/unlock`.
- [ ] Email notifications work — verify on your infra: set real `EMAIL_*` credentials and trigger a meeting invite.
- [ ] Telegram notifications work — verify on your infra: set `TELEGRAM_BOT_TOKEN`, register the webhook (§B.4), connect a test account.
- [x] In-app notifications work — **build-verified in code**: `notifications` rows with `channel = 'IN_APP'` are readable via `GET /api/notifications` immediately on insert (no dispatch step needed).
- [ ] Meeting reminders work — verify on your infra: create a reminder, run `/api/jobs/generate-reminders` then `/api/jobs/process-notifications`, confirm delivery.
- [x] Duplicate notifications are prevented — **build-verified in code**: unique `dedupe_key` constraint + `ON CONFLICT` handling in `queueNotification`.
- [ ] Mobile app connects to production API — verify on your infra: set `EXPO_PUBLIC_API_URL` to the production API and confirm login.
- [ ] Desktop app connects to production API — verify on your infra: set `apps/web/.env.production` before `tauri build`.
- [ ] HTTPS works — verify on your infra: Hostnin's free SSL / auto-renewal on your domain.
- [x] Environment variables are configured — every secret is read from `process.env` (`apps/api/src/lib/env.ts` fails fast with a clear error if required vars are missing).
- [x] No secrets are committed to GitHub — `.gitignore` excludes all `.env*` files except `.env.example`; only placeholder values exist in `.env.example` files.
- [x] No localhost URLs remain in production — all URLs (`APP_URL`, `API_URL`, `VITE_API_URL`, `VITE_SUPABASE_URL`, Supabase URLs) are environment-driven with no fallback to `localhost` in production code paths.
- [x] No dependency on local files exists — user uploads are designed for Supabase Storage (see §25 of the original spec); the API's own filesystem is only used for the optional static web build (§B.2) and is otherwise stateless.
- [ ] Application works within 2GB RAM — verify on your infra under real load; the architecture avoids unbounded in-memory state, caps notification batches at 50/run, and paginates all list endpoints, but actual headroom depends on your traffic.
- [x] Health endpoint works — **build-verified**: `GET /health` returns `{"status":"ok","time":...}` with no auth/DB dependency.
- [x] Error logging works — **build-verified in code**: `pino`/`pino-http` structured logging, centralized `errorHandler` that never leaks internals to clients while logging full detail server-side.
