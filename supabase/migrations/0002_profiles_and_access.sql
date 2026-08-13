-- ============================================================================
-- 0002_profiles_and_access.sql
-- Profiles, license/trial (user_access), plans, subscriptions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: 1:1 extension of auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  mobile text,
  company text,
  avatar_url text,
  role user_role not null default 'CLIENT',
  status account_status not null default 'ACTIVE',
  timezone text not null default 'UTC',
  created_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  locked_reason text,
  suspended_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(status);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- plans: reference table for current/future license tiers
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  max_calendars int,
  max_shared_members int,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.plans (code, name, description, is_default)
values ('STANDARD', 'Standard', 'Default plan for trial and activated users', true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- user_access: single source of truth for license/trial state.
-- This table is read by the API on every protected request.
-- ---------------------------------------------------------------------------
create table if not exists public.user_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  license_status license_status not null default 'TRIAL',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '15 days'),
  activated_at timestamptz,
  activated_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_access_status on public.user_access(license_status);
create index if not exists idx_user_access_trial_ends on public.user_access(trial_ends_at);

drop trigger if exists trg_user_access_updated_at on public.user_access;
create trigger trg_user_access_updated_at
  before update on public.user_access
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions: optional record of plan periods (kept for future billing;
-- not used to gate access today — user_access.license_status is authoritative)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'ACTIVE',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

-- ---------------------------------------------------------------------------
-- Trigger: whenever a new profile is created, bootstrap user_access.
-- ADMIN accounts are created ACTIVE with no trial constraint.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_plan_id uuid;
begin
  select id into default_plan_id from public.plans where is_default = true limit 1;

  if new.role = 'ADMIN' then
    insert into public.user_access (user_id, plan_id, license_status, trial_started_at, trial_ends_at, activated_at)
    values (new.id, default_plan_id, 'ACTIVE', now(), now(), now())
    on conflict (user_id) do nothing;
  else
    insert into public.user_access (user_id, plan_id, license_status, trial_started_at, trial_ends_at)
    values (new.id, default_plan_id, 'TRIAL', now(), now() + interval '15 days')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_profile on public.profiles;
create trigger trg_handle_new_profile
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- ---------------------------------------------------------------------------
-- Trigger: keep auth.users -> profiles in sync when a Supabase Auth user
-- is created via admin API (server-side, using the service role key).
-- Metadata (full_name, role, etc.) is expected to be supplied in
-- raw_user_meta_data by the API when it calls supabase.auth.admin.createUser().
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'CLIENT'),
    nullif(new.raw_user_meta_data->>'created_by', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
