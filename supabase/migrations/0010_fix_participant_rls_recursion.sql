-- ============================================================================
-- 0010_fix_participant_rls_recursion.sql
--
-- Fixes: "infinite recursion detected in policy for relation
-- \"event_participants\"" / "...meeting_participants..." (Postgres 42P17),
-- which was breaking GET /api/events and GET /api/meetings.
--
-- Root cause: events_select referenced event_participants inline via
-- `exists (select ... from event_participants ...)`, and
-- event_participants_select referenced events the same way. Because both
-- exist() subqueries ran as the querying user (not bypassing RLS), each
-- query against one table re-triggered the RLS policy on the other table,
-- which queried back into the first table, forever. The same pattern
-- existed between meetings and meeting_participants.
--
-- Fix: move each cross-table check into a small SECURITY DEFINER helper
-- function (same pattern already used by is_admin/can_view_calendar in
-- 0007_functions.sql). Migrations run as a role that bypasses RLS, so
-- these functions' internal queries do not re-trigger any policy — the
-- recursion is structurally impossible instead of just less likely.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants ep
    where ep.event_id = p_event_id and ep.user_id = auth.uid()
  );
$$;

-- Creator of the event, OR can edit the calendar it lives on.
create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select e.created_by = auth.uid() or public.can_edit_calendar(e.calendar_id)
      from public.events e
      where e.id = p_event_id
    ),
    false
  );
$$;

-- Creator of the event only (narrower than can_manage_event; matches the
-- original event_participants_update policy).
create or replace function public.is_event_creator(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.created_by = auth.uid() from public.events e where e.id = p_event_id),
    false
  );
$$;

create or replace function public.is_meeting_participant(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meeting_participants mp
    where mp.meeting_id = p_meeting_id and mp.user_id = auth.uid()
  );
$$;

-- Organizer of the meeting, OR an admin.
create or replace function public.can_manage_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.organizer_id = auth.uid() or public.is_admin()
      from public.meetings m
      where m.id = p_meeting_id
    ),
    false
  );
$$;

-- Organizer only (narrower than can_manage_meeting; matches the original
-- meeting_participants insert/update/delete policies).
create or replace function public.is_meeting_organizer(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.organizer_id = auth.uid() from public.meetings m where m.id = p_meeting_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- events (only the participant check changes)
-- ---------------------------------------------------------------------------
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (
    public.can_view_calendar(calendar_id)
    or created_by = auth.uid()
    or public.is_event_participant(id)
  );

-- ---------------------------------------------------------------------------
-- event_participants
-- ---------------------------------------------------------------------------
drop policy if exists event_participants_select on public.event_participants;
create policy event_participants_select on public.event_participants
  for select to authenticated
  using (user_id = auth.uid() or public.can_manage_event(event_id));

drop policy if exists event_participants_insert on public.event_participants;
create policy event_participants_insert on public.event_participants
  for insert to authenticated
  with check (public.can_manage_event(event_id));

drop policy if exists event_participants_update on public.event_participants;
create policy event_participants_update on public.event_participants
  for update to authenticated
  using (user_id = auth.uid() or public.is_event_creator(event_id))
  with check (user_id = auth.uid() or public.is_event_creator(event_id));

drop policy if exists event_participants_delete on public.event_participants;
create policy event_participants_delete on public.event_participants
  for delete to authenticated
  using (public.can_manage_event(event_id));

-- ---------------------------------------------------------------------------
-- meetings (only the participant check changes)
-- ---------------------------------------------------------------------------
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    organizer_id = auth.uid()
    or public.is_admin()
    or (calendar_id is not null and public.can_view_calendar(calendar_id))
    or public.is_meeting_participant(id)
  );

-- ---------------------------------------------------------------------------
-- meeting_participants
-- ---------------------------------------------------------------------------
drop policy if exists meeting_participants_select on public.meeting_participants;
create policy meeting_participants_select on public.meeting_participants
  for select to authenticated
  using (user_id = auth.uid() or public.can_manage_meeting(meeting_id));

drop policy if exists meeting_participants_insert on public.meeting_participants;
create policy meeting_participants_insert on public.meeting_participants
  for insert to authenticated
  with check (public.is_meeting_organizer(meeting_id));

drop policy if exists meeting_participants_update on public.meeting_participants;
create policy meeting_participants_update on public.meeting_participants
  for update to authenticated
  using (user_id = auth.uid() or public.is_meeting_organizer(meeting_id))
  with check (user_id = auth.uid() or public.is_meeting_organizer(meeting_id));

drop policy if exists meeting_participants_delete on public.meeting_participants;
create policy meeting_participants_delete on public.meeting_participants
  for delete to authenticated
  using (public.is_meeting_organizer(meeting_id));
