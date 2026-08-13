-- ============================================================================
-- 0006_notes_audit.sql
-- Notes and admin audit logs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- notes: lightweight notes attached to a meeting/task/event, or general.
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  entity_type note_entity_type not null default 'GENERAL',
  entity_id uuid,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_owner on public.notes(owner_id);
create index if not exists idx_notes_entity on public.notes(entity_type, entity_id);

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs: immutable record of administrator actions.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_admin on public.audit_logs(admin_id);
create index if not exists idx_audit_logs_target on public.audit_logs(target_user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
