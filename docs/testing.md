# Testing instructions

## Automated

```bash
npm install
npm run build:shared
npm run typecheck   # tsc --noEmit across apps/api, apps/web, packages/shared
npm run build        # full production build: shared → api → web
```

There is no test framework wired up yet (e.g. Vitest/Jest + Supertest) — the project is structured so adding one is straightforward: `apps/api` routes are plain Express routers that can be exercised with `supertest` against `createApp()`, and `packages/shared`'s pure functions (`trialDaysRemaining`, `rangeForView`, etc.) are trivial to unit test in isolation. Adding `apps/api/src/**/*.test.ts` + a `vitest` config is a natural next step before scaling the team.

## Manual smoke test (run once against a fresh local environment)

1. **Bootstrap**: `supabase start`, run the app (`npm run dev:api`, `npm run dev:web`), create your first admin (README §10).
2. **Admin creates a client**: Admin Dashboard → Users & Clients → Create User → role `CLIENT`. Confirm an activation email is "sent" (check the API logs if SMTP isn't configured locally — `emailEnabled` will be `false` and the log will say so instead of throwing).
3. **Activation**: open the activation link → set a password → land on the Dashboard.
4. **Trial visible**: confirm the top bar shows "Trial: 15d left" (or close to it) for the new client.
5. **Calendar**: create an event, drag it to a new time, resize it, delete it. Switch through Day/Week/Month/Agenda/Year views.
6. **Meeting**: create a meeting inviting a second test user; sign in as that user and Accept/Decline/Maybe; confirm the organizer sees an in-app notification.
7. **Reschedule/cancel**: as the organizer, reschedule then cancel the meeting; confirm participants get `MEETING_CHANGED`/`MEETING_CANCELLED` in-app notifications.
8. **Tasks**: create a task assigned to another user; confirm they see a `TASK_ASSIGNED` notification; move it across To Do → In Progress → Completed.
9. **Reminders**: create a reminder 5 minutes before an existing meeting; call `POST /api/jobs/generate-reminders` then `POST /api/jobs/process-notifications` (with the `X-Cron-Secret` header) once the fire time has passed; confirm the notification appears.
10. **Search**: use the top bar search for the event/meeting/task/person you just created.
11. **Notes**: add a note, confirm it appears in the Notes page.
12. **Admin license actions**: from Admin → Users, Activate the client (TRIAL → ACTIVE), then Lock them (confirm they're immediately blocked from the app on next request), then Unlock.
13. **Audit log**: confirm every admin action above appears in Admin → Audit Log with the correct actor/target/timestamp.
14. **Trial expiry**: manually set a test user's `user_access.trial_ends_at` to a past timestamp in Supabase Studio, call `POST /api/jobs/expire-trials`, confirm that user now sees the trial-expired screen instead of the app.
15. **Health**: `curl http://localhost:4000/health` → `{"status":"ok",...}`.
