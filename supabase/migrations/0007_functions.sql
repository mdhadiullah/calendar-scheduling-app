-- ============================================================================
-- 0007_functions.sql
-- Helper functions used by RLS policies and by the backend API (via RPC).
-- All SECURITY DEFINER functions have a locked-down search_path.
-- ============================================================================

-- Current caller's role (ADMIN/MANAGER/EMPLOYEE/CLIENT), or null if not signed in.
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'ADMIN' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('ADMIN','MANAGER') from public.profiles where id = auth.uid()), false);
$$;

-- True if the signed-in user's account is usable right now: ACTIVE account
-- status AND (TRIAL or ACTIVE) license status. Admins are always permitted.
create or replace function public.is_permitted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role = 'ADMIN'
        or (
          p.status = 'ACTIVE'
          and exists (
            select 1 from public.user_access ua
            where ua.user_id = p.id
              and ua.license_status in ('TRIAL', 'ACTIVE')
          )
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

-- Calendar membership helpers -------------------------------------------------
create or replace function public.is_calendar_owner(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.calendars c
    where c.id = p_calendar_id and c.owner_id = auth.uid()
  );
$$;

create or replace function public.calendar_permission_for(p_calendar_id uuid)
returns calendar_permission
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.calendars c where c.id = p_calendar_id and c.owner_id = auth.uid())
      then 'OWNER'::calendar_permission
    else (
      select cm.permission from public.calendar_members cm
      where cm.calendar_id = p_calendar_id and cm.user_id = auth.uid()
    )
  end;
$$;

create or replace function public.can_view_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.calendar_permission_for(p_calendar_id) is not null;
$$;

create or replace function public.can_edit_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.calendar_permission_for(p_calendar_id) in ('OWNER', 'EDITOR');
$$;

-- ---------------------------------------------------------------------------
-- Admin actions (called from the API using the service role; also callable
-- via RPC from a trusted server context). Each writes an audit_log row.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_license_status(
  p_target_user_id uuid,
  p_status license_status,
  p_admin_id uuid,
  p_extend_days int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_access
  set
    license_status = p_status,
    activated_at = case when p_status = 'ACTIVE' then now() else activated_at end,
    activated_by = case when p_status = 'ACTIVE' then p_admin_id else activated_by end,
    cancelled_at = case when p_status = 'CANCELLED' then now() else cancelled_at end,
    cancelled_by = case when p_status = 'CANCELLED' then p_admin_id else cancelled_by end,
    trial_ends_at = case when p_extend_days is not null then now() + make_interval(days => p_extend_days) else trial_ends_at end
  where user_id = p_target_user_id;

  insert into public.audit_logs (admin_id, action, target_user_id, metadata)
  values (p_admin_id, 'LICENSE_STATUS_CHANGED', p_target_user_id,
    jsonb_build_object('new_status', p_status, 'extend_days', p_extend_days));
end;
$$;

-- Expire trials whose trial_ends_at has passed. Intended to be invoked by
-- the scheduled /api/jobs/expire-trials endpoint (see apps/api).
create or replace function public.expire_trials()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  update public.user_access
  set license_status = 'EXPIRED'
  where license_status = 'TRIAL' and trial_ends_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;
