-- ============================================================================
-- 0009_default_grants.sql
-- Ensures anon/authenticated/service_role have base table privileges.
-- RLS policies (0008_rls_policies.sql) remain the real authorization
-- boundary — this just makes sure the roles are permitted to query the
-- tables at all, which some local Supabase CLI versions don't set up
-- automatically for tables created via migrations.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all privileges on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all privileges on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all privileges on functions to anon, authenticated, service_role;