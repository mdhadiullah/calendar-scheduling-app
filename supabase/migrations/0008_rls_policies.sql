-- ============================================================================
-- 0008_rls_policies.sql
-- Row Level Security for every application table.
--
-- Design notes:
--  * The backend API authenticates end users with their own Supabase JWT
--    (forwarded from the client) for normal reads/writes, so these policies
--    are the real authorization boundary — never trust the frontend alone.
--  * The backend ALSO holds the service_role key for privileged operations
--    (creating users, processing notifications, admin license changes).
--    The service role bypasses RLS by design; it is never exposed to any
--    frontend (web/desktop/mobile) — see apps/api/src/lib/supabaseAdmin.ts.
--  * A trigger (enforce_profile_update_restrictions) prevents non-admins
--    from elevating their own role or clearing their own lock/suspension,
--    since RLS alone cannot restrict individual columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (true); -- needed so users can see participant/assignee names across the org

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

create or replace function public.enforce_profile_update_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.locked_at is distinct from old.locked_at
     or new.locked_by is distinct from old.locked_by
     or new.locked_reason is distinct from old.locked_reason
     or new.created_by is distinct from old.created_by then
    raise exception 'Only an administrator may change role, status, or lock fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_restrictions on public.profiles;
create trigger trg_enforce_profile_update_restrictions
  before update on public.profiles
  for each row execute function public.enforce_profile_update_restrictions();

-- ---------------------------------------------------------------------------
-- plans (read-only reference data)
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;

create policy plans_select_authenticated on public.plans
  for select to authenticated using (true);

create policy plans_admin_write on public.plans
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- user_access
-- ---------------------------------------------------------------------------
alter table public.user_access enable row level security;

create policy user_access_select_self_or_admin on public.user_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy user_access_admin_write on public.user_access
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

create policy subscriptions_select_self_or_admin on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy subscriptions_admin_write on public.subscriptions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- calendars
-- ---------------------------------------------------------------------------
alter table public.calendars enable row level security;

create policy calendars_select on public.calendars
  for select to authenticated
  using (public.can_view_calendar(id));

create policy calendars_insert on public.calendars
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_permitted());

create policy calendars_update on public.calendars
  for update to authenticated
  using (public.is_calendar_owner(id) or public.is_admin())
  with check (public.is_calendar_owner(id) or public.is_admin());

create policy calendars_delete on public.calendars
  for delete to authenticated
  using (public.is_calendar_owner(id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- calendar_members
-- ---------------------------------------------------------------------------
alter table public.calendar_members enable row level security;

create policy calendar_members_select on public.calendar_members
  for select to authenticated
  using (public.can_view_calendar(calendar_id));

create policy calendar_members_write on public.calendar_members
  for all to authenticated
  using (public.can_edit_calendar(calendar_id))
  with check (public.can_edit_calendar(calendar_id));

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

create policy events_select on public.events
  for select to authenticated
  using (
    public.can_view_calendar(calendar_id)
    or created_by = auth.uid()
    or exists (select 1 from public.event_participants ep where ep.event_id = id and ep.user_id = auth.uid())
  );

create policy events_insert on public.events
  for insert to authenticated
  with check (public.can_edit_calendar(calendar_id) and public.is_permitted());

create policy events_update on public.events
  for update to authenticated
  using (created_by = auth.uid() or public.can_edit_calendar(calendar_id))
  with check (created_by = auth.uid() or public.can_edit_calendar(calendar_id));

create policy events_delete on public.events
  for delete to authenticated
  using (created_by = auth.uid() or public.can_edit_calendar(calendar_id));

-- ---------------------------------------------------------------------------
-- event_participants
-- ---------------------------------------------------------------------------
alter table public.event_participants enable row level security;

create policy event_participants_select on public.event_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and (e.created_by = auth.uid() or public.can_edit_calendar(e.calendar_id)))
  );

create policy event_participants_insert on public.event_participants
  for insert to authenticated
  with check (
    exists (select 1 from public.events e where e.id = event_id and (e.created_by = auth.uid() or public.can_edit_calendar(e.calendar_id)))
  );

create policy event_participants_update on public.event_participants
  for update to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()))
  with check (user_id = auth.uid() or exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));

create policy event_participants_delete on public.event_participants
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (e.created_by = auth.uid() or public.can_edit_calendar(e.calendar_id))));

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------
alter table public.meetings enable row level security;

create policy meetings_select on public.meetings
  for select to authenticated
  using (
    organizer_id = auth.uid()
    or public.is_admin()
    or (calendar_id is not null and public.can_view_calendar(calendar_id))
    or exists (select 1 from public.meeting_participants mp where mp.meeting_id = id and mp.user_id = auth.uid())
  );

create policy meetings_insert on public.meetings
  for insert to authenticated
  with check (organizer_id = auth.uid() and public.is_permitted());

create policy meetings_update on public.meetings
  for update to authenticated
  using (organizer_id = auth.uid() or public.is_admin())
  with check (organizer_id = auth.uid() or public.is_admin());

create policy meetings_delete on public.meetings
  for delete to authenticated
  using (organizer_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- meeting_participants
-- ---------------------------------------------------------------------------
alter table public.meeting_participants enable row level security;

create policy meeting_participants_select on public.meeting_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.meetings m where m.id = meeting_id and (m.organizer_id = auth.uid() or public.is_admin()))
  );

create policy meeting_participants_insert on public.meeting_participants
  for insert to authenticated
  with check (exists (select 1 from public.meetings m where m.id = meeting_id and m.organizer_id = auth.uid()));

create policy meeting_participants_update on public.meeting_participants
  for update to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.meetings m where m.id = meeting_id and m.organizer_id = auth.uid()))
  with check (user_id = auth.uid() or exists (select 1 from public.meetings m where m.id = meeting_id and m.organizer_id = auth.uid()));

create policy meeting_participants_delete on public.meeting_participants
  for delete to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and m.organizer_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;

create policy tasks_select on public.tasks
  for select to authenticated
  using (created_by = auth.uid() or assigned_to = auth.uid() or public.is_manager_or_admin());

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_permitted());

create policy tasks_update on public.tasks
  for update to authenticated
  using (created_by = auth.uid() or assigned_to = auth.uid() or public.is_manager_or_admin())
  with check (created_by = auth.uid() or assigned_to = auth.uid() or public.is_manager_or_admin());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (created_by = auth.uid() or public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- reminders (private to the user)
-- ---------------------------------------------------------------------------
alter table public.reminders enable row level security;

create policy reminders_all_self on public.reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notification_preferences (private to the user)
-- ---------------------------------------------------------------------------
alter table public.notification_preferences enable row level security;

create policy notification_preferences_all_self on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- telegram_connections (private to the user; admin may view for support)
-- ---------------------------------------------------------------------------
alter table public.telegram_connections enable row level security;

create policy telegram_connections_select on public.telegram_connections
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy telegram_connections_write_self on public.telegram_connections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications (read-only to the owning user; writes are server-side only
-- via the service role, which bypasses RLS)
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_select_self on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
alter table public.notes enable row level security;

create policy notes_select on public.notes
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy notes_write_self on public.notes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_logs (admin read-only; writes happen via SECURITY DEFINER functions
-- or the service role)
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());
