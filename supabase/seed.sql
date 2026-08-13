-- ============================================================================
-- seed.sql — local development only. Never run against production.
--
-- Supabase local dev already creates the auth schema. To get a working
-- admin account for local testing, either:
--
--   1. Run `npm run dev:api` and call POST /api/admin/bootstrap once (only
--      works when there are zero ADMIN profiles in the database), OR
--   2. Use the Supabase Studio (http://localhost:54323) "Authentication"
--      tab to create a user manually, then run:
--
--      update public.profiles set role = 'ADMIN' where email = 'you@example.com';
--
-- We intentionally do not seed fake auth.users rows here because
-- auth.users must be created through supabase-js/GoTrue so passwords are
-- hashed correctly.
-- ============================================================================

-- Example: seed a couple of reference plans beyond the default STANDARD plan.
insert into public.plans (code, name, description, is_default)
values ('PRO', 'Pro', 'Full-featured plan for activated teams', false)
on conflict (code) do nothing;
