-- ============================================================================
-- 0005_reminders_notifications.sql
-- Reminders (user-configured rules), notifications (dispatch queue),
-- notification_preferences, telegram_connections.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reminders: user-configured "remind me before X" rules attached to an
-- event / meeting / task. The notification processor expands these into
-- concrete rows in `notifications` ahead of time.
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type reminder_entity_type not null,
  entity_id uuid not null,
  minutes_before int, -- 5, 10, 15, 30, 60, 1440 (1 day), or custom
  custom_remind_at timestamptz, -- used when minutes_before is null (custom absolute time)
  channels notification_channel[] not null default array['IN_APP']::notification_channel[],
  created_at timestamptz not null default now(),
  constraint chk_reminder_has_time check (minutes_before is not null or custom_remind_at is not null)
);

create index if not exists idx_reminders_user on public.reminders(user_id);
create index if not exists idx_reminders_entity on public.reminders(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- notification_preferences: per-user channel opt-in/out
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  telegram_enabled boolean not null default false,
  meeting_notifications boolean not null default true,
  task_notifications boolean not null default true,
  reminder_notifications boolean not null default true,
  trial_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- telegram_connections: links a Supabase user to a Telegram chat id
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  telegram_chat_id text unique,
  telegram_username text,
  connect_token text unique,
  connect_token_expires_at timestamptz,
  is_active boolean not null default false,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_telegram_connections_chat_id on public.telegram_connections(telegram_chat_id);
create index if not exists idx_telegram_connections_token on public.telegram_connections(connect_token);

drop trigger if exists trg_telegram_connections_updated_at on public.telegram_connections;
create trigger trg_telegram_connections_updated_at
  before update on public.telegram_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications: the dispatch queue. Rows are created either by triggers
-- (e.g. meeting invite) or by the reminder-expansion job, then processed
-- by the /api/jobs/process-notifications endpoint (invoked by an external
-- cron / Hostnin scheduled task). `dedupe_key` guarantees idempotency.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type notification_type not null,
  channel notification_channel not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  status notification_status not null default 'PENDING',
  retry_count int not null default 0,
  max_retries int not null default 3,
  error_message text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_status on public.notifications(status);
create index if not exists idx_notifications_scheduled_at on public.notifications(scheduled_at);
create index if not exists idx_notifications_status_scheduled on public.notifications(status, scheduled_at);
