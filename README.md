# Calendar & Scheduling

A production-ready **Calendar + Meeting + Scheduling + Task + Reminder** application for Web, Windows/macOS Desktop, Android, and iOS — deliberately **not** an ERP (no invoices, inventory, quotations, or accounting).

Built to run comfortably on **Hostnin Node.js Hosting "Pro"** (3 CPU cores, 2GB RAM, no root/VPS/Docker/Kubernetes) with **Supabase Cloud** as the managed Postgres + Auth + Storage + Realtime backend.

---

## 1. Architecture

```
                        ┌────────────────────────────────────────┐
                        │              Supabase Cloud             │
                        │  Postgres · Auth · Storage · Realtime    │
                        │  Row Level Security enforces per-user    │
                        │  data access on every table               │
                        └───────────────▲──────────────▲───────────┘
                                         │ service_role  │ user JWT
                                         │ (server-only) │ (RLS-scoped)
                        ┌────────────────┴──────────────┴───────────┐
                        │        apps/api — Express + TypeScript     │
                        │  REST API · license/role enforcement ·     │
                        │  email (SMTP) · Telegram Bot API ·          │
                        │  notification queue + /api/jobs/* endpoints │
                        │  Runs on Hostnin Node.js Hosting (Pro)      │
                        └───────────────▲──────────────────────────┘
                                         │ HTTPS (fetch)
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
┌───────┴───────┐              ┌─────────┴────────┐             ┌─────────┴────────┐
│  apps/web       │             │  apps/desktop      │            │  apps/mobile       │
│  React + Vite   │◄── wraps ──│  Tauri (native      │            │  React Native +    │
│  (static build) │             │  shell around web)  │            │  Expo               │
└─────────────────┘             └────────────────────┘             └────────────────────┘
```

- **apps/web**, **apps/desktop**, and **apps/mobile** all use `packages/shared` (TypeScript types, the `ApiClient` fetch wrapper, and business-rule helpers like trial/license math) so behavior stays consistent across platforms.
- **apps/desktop** is not a separate UI — it's the same `apps/web` build running inside a native Tauri window. It is *built and distributed to users' machines*; it is never deployed to Hostnin.
- **apps/api** is the only thing that talks to Supabase with the privileged `service_role` key. It is the sole enforcement point for authentication, account status, lock status, and license status (spec section 9) — the frontend is never trusted for authorization.
- Row Level Security (RLS) is the second, independent enforcement layer: even if the API had a bug, direct Supabase queries from a client using a normal user JWT are still constrained by policy.
- There is no persistent background worker. Notification delivery is handled by short, idempotent HTTP endpoints (`/api/jobs/*`) invoked by an external scheduler (Hostnin's cron/scheduled-task feature) — see [§10](#10-notification-engine--no-persistent-worker).

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web frontend | React + TypeScript + Vite | Small, fast bundle; no server-side rendering needed for an authenticated app |
| Backend API | Node.js + TypeScript + Express | Simple, well-understood, deploys as a plain Node process on Hostnin |
| Database / Auth / Storage | Supabase Cloud (Postgres) | Managed — no self-hosted Postgres/Redis on Hostnin required |
| Desktop | Tauri | Native installer wrapping the same web build; tiny footprint vs. Electron |
| Mobile | React Native + Expo | Single codebase for Android + iOS |
| Calendar UI | react-big-calendar (+ drag-and-drop addon) | Day/Week/Month/Agenda views with real drag/resize out of the box |
| Email | Nodemailer (SMTP) | Works with any SMTP provider via env vars — no vendor lock-in |
| Telegram | Telegram Bot API (raw HTTPS, no heavy SDK) | Lightweight, no extra dependency |

## 3. Monorepo layout

```
calendar-app/
├── apps/
│   ├── api/           REST API (Express + TypeScript) — deploys to Hostnin
│   ├── web/            React web app — static build deploys to Hostnin (or served by apps/api)
│   ├── desktop/         Tauri shell around apps/web — built locally, distributed to users
│   └── mobile/          Expo React Native app — built via EAS, distributed via app stores
├── packages/
│   └── shared/          Shared types, API client, business rules (trial/license, dates, reminders)
├── supabase/
│   ├── migrations/      Numbered SQL migrations (schema + RLS + functions)
│   ├── seed.sql          Local dev seed notes
│   └── config.toml       Supabase CLI local dev config
└── docs/                 Deployment, testing, and operational runbooks
```

## 4. Database schema

See `supabase/migrations/*.sql` for the full, commented source of truth. Summary of tables:

`profiles`, `plans`, `user_access` (license/trial), `subscriptions`, `calendars`, `calendar_members`, `events`, `event_participants`, `meetings`, `meeting_participants`, `tasks`, `reminders`, `notification_preferences`, `telegram_connections`, `notifications`, `notes`, `audit_logs`.

Every table has RLS enabled (`supabase/migrations/0008_rls_policies.sql`). Key rules:
- Users can only read/write calendars, events, meetings, and tasks they own, are a member of, or are a participant/assignee on.
- `notifications` is **read-only** to end users — only the API's `service_role` client (never exposed to any frontend) can insert/update rows, which is how idempotent delivery and retry tracking stay tamper-proof.
- A trigger (`enforce_profile_update_restrictions`) blocks non-admins from changing their own `role`, `status`, or lock fields even if they call the Supabase REST API directly with their own JWT — RLS alone can't do column-level restrictions, so this closes that gap.
- Helper SQL functions (`is_admin`, `is_permitted`, `can_view_calendar`, `can_edit_calendar`, `admin_set_license_status`, `expire_trials`) centralize the authorization logic used across policies and admin actions.

Indexes cover every foreign key plus `start_at`/`end_at`/`due_at`/`scheduled_at`/`status`/`email`/Telegram identifier columns per spec §14.

## 5. Authentication flow

Login, logout, password reset, and session refresh are handled **directly by Supabase Auth** via `supabase-js` in the web/mobile clients — Supabase already implements these securely (hashed passwords, short-lived JWTs, refresh tokens, rate limiting on auth endpoints), so the API does not reimplement them. What the API *does* own:

- **Account provisioning**: `POST /api/admin/users` (admin-only) creates the `auth.users` row via `supabase.auth.admin.createUser()` with a random, never-transmitted temporary password, then emails a one-time Supabase "recovery" link (doubling as a secure activation link) so the user sets their own password. No password ever travels over email or Telegram.
- **Authorization**: every request to `apps/api` is validated in `middleware/auth.ts` (token → Supabase user → profile → lock/status checks) and `middleware/requirePermitted.ts` (license/trial check), per spec §9.

## 6. License / 15-day trial architecture

- `user_access.trial_started_at` / `trial_ends_at` are set automatically by a database trigger (`handle_new_profile`) the moment a profile row is created — 15 days for every non-admin role; admins are created `ACTIVE` immediately.
- `license_status` moves `TRIAL → ACTIVE` (admin one-click "Activate Full Version"), `TRIAL → EXPIRED` (automatic, via the `expire-trials` scheduled job), or `→ LOCKED` / `→ CANCELLED` (admin actions).
- `middleware/requirePermitted.ts` is the single server-side gate: admins always pass; everyone else must be `TRIAL` or `ACTIVE`. This cannot be bypassed from the frontend.
- The web/mobile apps show a dedicated "trial expired / account locked" screen (`AccessRestrictedPage` / mobile equivalent) instead of the normal app shell when the API returns a `402`/`403` license error.

## 7. Notification architecture (no persistent worker)

Hostnin's managed Node.js hosting does not guarantee a long-lived background process survives restarts/redeploys, so notifications are **database-driven and idempotent**, processed by short HTTP endpoints an external scheduler calls:

| Endpoint | Purpose | Suggested frequency |
|---|---|---|
| `POST /api/jobs/generate-reminders` | Expands due `reminders` rows into concrete `notifications` rows (60-minute lookahead) | every 5 min |
| `POST /api/jobs/process-notifications` | Sends up to 50 due `PENDING` notifications (in-app/email/Telegram), with retry + backoff | every 1–2 min |
| `POST /api/jobs/expire-trials` | Flips expired trials `TRIAL → EXPIRED`, queues a `TRIAL_EXPIRED` notification | every hour |
| `POST /api/jobs/trial-warnings` | Queues one `TRIAL_EXPIRING` warning/day for trials ending within 3 days | once/day |
| `POST /api/jobs/run-all` | Convenience: runs `generate-reminders` + `process-notifications` in one call, for hosts with only one cron slot | every 2–5 min |

All `/api/jobs/*` endpoints require an `X-Cron-Secret` header matching `CRON_SECRET` — see [§13 deployment](docs/deployment.md) for wiring this up with Hostnin's cron feature. Every `notifications` row carries `user_id, event_id/entity_id, type, channel, scheduled_at, sent_at, status, retry_count, error_message` (spec §13) and a unique `dedupe_key`, so re-running a job (or a flaky cron double-firing) can never send a duplicate message.

## 8. Telegram & Email

- **Telegram**: users tap "Connect Telegram" in Settings, which generates a short-lived token and a `t.me/<bot>?start=<token>` deep link — no password is ever requested. `POST /api/telegram/webhook` (registered once via `setTelegramWebhook`) completes the link when the user sends `/start <token>`.
- **Email**: all templates live in `apps/api/src/services/emailTemplates.ts` (meeting invite/reminder/cancelled/rescheduled, trial expiring/expired, account created/activated/locked/unlocked, password reset). SMTP credentials are entirely environment-driven (`EMAIL_*`) — no hard-coded provider.

## 9. Environment configuration

Each app has its own `.env.example`:
- `apps/api/.env.example` — Supabase (URL/anon/service-role), SMTP, Telegram bot token, `CRON_SECRET`, CORS origins.
- `apps/web/.env.example` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (all public/non-secret, safe to ship in a browser bundle).
- `apps/mobile/.env.example` — `EXPO_PUBLIC_*` equivalents.

**Never commit `.env` files.** `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PASSWORD`, and `TELEGRAM_BOT_TOKEN` must only ever exist as server-side environment variables (local `.env`, or Hostnin's environment variable panel in production) — never in frontend `.env` files, never in git.

## 10. Local development

```bash
# 1. Install the Supabase CLI (see https://supabase.com/docs/guides/cli) and Docker Desktop (used only locally)
supabase start                       # boots local Postgres/Auth/Storage + runs migrations in supabase/migrations
supabase status                      # prints your local API URL / anon key / service role key

# 2. Install JS dependencies (root — installs all workspaces)
npm install

# 3. Configure environment
cp apps/api/.env.example apps/api/.env       # fill in the local SUPABASE_URL / keys from step 1
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env # optional, only if working on mobile

# 4. Run the API and web app together
npm run dev:api      # http://localhost:4000
npm run dev:web       # http://localhost:5173
```

Create your first administrator locally: sign up a user via Supabase Studio (`http://localhost:54323` → Authentication → Add user), then run in the SQL editor:

```sql
update public.profiles set role = 'ADMIN' where email = 'you@example.com';
```

(That user's `user_access` row is automatically set to `ACTIVE` by the `handle_new_profile` trigger going forward — for a user that already existed before becoming admin, also run `update public.user_access set license_status = 'ACTIVE', activated_at = now() where user_id = (select id from public.profiles where email = 'you@example.com');`.)

## 11. Testing

- `npm run typecheck` (root) — runs `tsc --noEmit` across `apps/api`, `apps/web`, and `packages/shared`.
- `npm run build` (root) — production build for `packages/shared` → `apps/api` → `apps/web`; this is the same sequence CI/Hostnin should run before starting the server.
- `GET /health` — smoke-test the API is up (used by Hostnin/uptime monitors, no auth, no DB dependency).
- Manual smoke test checklist: see `docs/testing.md`.

## 12. GitHub → Hostnin workflow

```
local dev (Supabase local) → git commit → GitHub → Supabase Cloud (production project)
                                                 └─► Hostnin Pro (GitHub deploy) → apps/api serves the built apps/web
```

Full step-by-step deployment instructions (including how to wire up the scheduled jobs without a persistent worker) are in **[docs/deployment.md](docs/deployment.md)**.

## 13. Production checklist

See **[docs/checklist.md](docs/checklist.md)** — a checkbox-by-checkbox mapping to spec §30.

## 14. What's fully wired vs. reference-quality

To set expectations clearly for a from-scratch build of this size:

- **Fully implemented and typechecked**: database schema + RLS, the entire `apps/api` REST surface (auth/license/admin/calendars/events/meetings/tasks/reminders/notifications/telegram/notes/search/jobs), and the `apps/web` app (all pages/flows in the spec, production build verified).
- **Day/Week/Month/Agenda** calendar views have full drag-and-drop and resize. **Year** view is a custom lightweight month-grid (click a day to jump into Day view). **3-Day** view currently renders the Week view as a placeholder (noted directly in `apps/web/src/components/calendar/ThreeDayNote.tsx`) — a true 3-column time grid is a follow-up, not a blocker for the rest of the app.
- **Desktop (Tauri)** is a real, buildable native shell config around `apps/web` — building installers requires Rust + platform build tools on your machine (see `apps/desktop/README.md`); it could not be compiled inside this sandbox.
- **Mobile (Expo)** ships working Calendar/Tasks/Notifications/Profile screens and a quick-create flow wired to the same API, with a deliberately simplified date entry (text input rather than a native date picker, to avoid an extra native dependency in this reference build) — see `apps/mobile/README.md` for what to harden before shipping to app stores. It was hand-verified for structural correctness but not run through Expo (no device/emulator available in this sandbox).
