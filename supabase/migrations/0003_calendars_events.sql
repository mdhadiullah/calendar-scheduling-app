-- ============================================================================
-- 0003_calendars_events.sql
-- Calendars, calendar membership, events, event participants.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- calendars
-- ---------------------------------------------------------------------------
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  type calendar_type not null default 'PERSONAL',
  color text not null default '#4F46E5',
  timezone text not null default 'UTC',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendars_owner on public.calendars(owner_id);

drop trigger if exists trg_calendars_updated_at on public.calendars;
create trigger trg_calendars_updated_at
  before update on public.calendars
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- calendar_members: sharing / permissions
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_members (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission calendar_permission not null default 'VIEWER',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (calendar_id, user_id)
);

create index if not exists idx_calendar_members_calendar on public.calendar_members(calendar_id);
create index if not exists idx_calendar_members_user on public.calendar_members(user_id);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  location text,
  video_link text,
  category text,
  color text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'UTC',
  status event_status not null default 'CONFIRMED',
  recurrence_rule text, -- RFC5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR
  recurrence_parent_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_event_time check (end_at >= start_at)
);

create index if not exists idx_events_calendar on public.events(calendar_id);
create index if not exists idx_events_created_by on public.events(created_by);
create index if not exists idx_events_start_at on public.events(start_at);
create index if not exists idx_events_end_at on public.events(end_at);
create index if not exists idx_events_recurrence_parent on public.events(recurrence_parent_id);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- event_participants
-- ---------------------------------------------------------------------------
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response_status participant_response not null default 'PENDING',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, user_id)
);

create index if not exists idx_event_participants_event on public.event_participants(event_id);
create index if not exists idx_event_participants_user on public.event_participants(user_id);
