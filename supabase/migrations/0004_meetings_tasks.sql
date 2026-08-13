-- ============================================================================
-- 0004_meetings_tasks.sql
-- Meetings, meeting participants, tasks.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- meetings
-- A meeting may optionally be linked to a calendar event so it renders on
-- the calendar grid; it also carries meeting-specific status/notes.
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  calendar_id uuid references public.calendars(id) on delete set null,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  location text,
  video_link text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'UTC',
  status meeting_status not null default 'SCHEDULED',
  notes text,
  rescheduled_from timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_meeting_time check (end_at >= start_at)
);

create index if not exists idx_meetings_organizer on public.meetings(organizer_id);
create index if not exists idx_meetings_start_at on public.meetings(start_at);
create index if not exists idx_meetings_status on public.meetings(status);
create index if not exists idx_meetings_event on public.meetings(event_id);

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meeting_participants
-- ---------------------------------------------------------------------------
create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role meeting_role not null default 'ATTENDEE',
  response_status participant_response not null default 'PENDING',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index if not exists idx_meeting_participants_meeting on public.meeting_participants(meeting_id);
create index if not exists idx_meeting_participants_user on public.meeting_participants(user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  priority task_priority not null default 'MEDIUM',
  status task_status not null default 'TODO',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_due_at on public.tasks(due_at);
create index if not exists idx_tasks_status on public.tasks(status);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
