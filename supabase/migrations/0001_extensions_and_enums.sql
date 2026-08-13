-- ============================================================================
-- 0001_extensions_and_enums.sql
-- Extensions and shared ENUM types for the Calendar & Scheduling application.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles & account status
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('ACTIVE', 'SUSPENDED', 'LOCKED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Licensing / trial
-- ---------------------------------------------------------------------------
do $$ begin
  create type license_status as enum ('TRIAL', 'ACTIVE', 'EXPIRED', 'LOCKED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Calendars
-- ---------------------------------------------------------------------------
do $$ begin
  create type calendar_type as enum ('PERSONAL', 'TEAM', 'SHARED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type calendar_permission as enum ('OWNER', 'EDITOR', 'VIEWER');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
do $$ begin
  create type event_status as enum ('CONFIRMED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type participant_response as enum ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------------------------
do $$ begin
  create type meeting_status as enum ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_role as enum ('ORGANIZER', 'ATTENDEE');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
do $$ begin
  create type task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Reminders / Notifications
-- ---------------------------------------------------------------------------
do $$ begin
  create type reminder_entity_type as enum ('EVENT', 'MEETING', 'TASK');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('IN_APP', 'EMAIL', 'TELEGRAM');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'MEETING_INVITE',
    'MEETING_ACCEPTED',
    'MEETING_DECLINED',
    'MEETING_TENTATIVE',
    'MEETING_CHANGED',
    'MEETING_CANCELLED',
    'MEETING_REMINDER',
    'EVENT_REMINDER',
    'TASK_ASSIGNED',
    'TASK_REMINDER',
    'TASK_DUE',
    'TRIAL_EXPIRING',
    'TRIAL_EXPIRED',
    'ACCOUNT_CREATED',
    'ACCOUNT_ACTIVATED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'PASSWORD_RESET'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
do $$ begin
  create type note_entity_type as enum ('EVENT', 'MEETING', 'TASK', 'GENERAL');
exception when duplicate_object then null; end $$;

-- Reusable updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
