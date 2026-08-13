// ============================================================================
// Shared domain types. These mirror the Supabase/Postgres schema
// (see supabase/migrations) and are consumed by web, desktop, and mobile.
// ============================================================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CLIENT';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
export type LicenseStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'LOCKED' | 'CANCELLED';

export type CalendarType = 'PERSONAL' | 'TEAM' | 'SHARED';
export type CalendarPermission = 'OWNER' | 'EDITOR' | 'VIEWER';

export type EventStatus = 'CONFIRMED' | 'CANCELLED';
export type ParticipantResponse = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';

export type MeetingStatus = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type MeetingRole = 'ORGANIZER' | 'ATTENDEE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type ReminderEntityType = 'EVENT' | 'MEETING' | 'TASK';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'TELEGRAM';
export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type NoteEntityType = 'EVENT' | 'MEETING' | 'TASK' | 'GENERAL';

export type NotificationType =
  | 'MEETING_INVITE'
  | 'MEETING_ACCEPTED'
  | 'MEETING_DECLINED'
  | 'MEETING_TENTATIVE'
  | 'MEETING_CHANGED'
  | 'MEETING_CANCELLED'
  | 'MEETING_REMINDER'
  | 'EVENT_REMINDER'
  | 'TASK_ASSIGNED'
  | 'TASK_REMINDER'
  | 'TASK_DUE'
  | 'TRIAL_EXPIRING'
  | 'TRIAL_EXPIRED'
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_ACTIVATED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_RESET';

export const REMINDER_PRESETS_MINUTES = [5, 10, 15, 30, 60, 1440] as const;
export type ReminderPresetMinutes = (typeof REMINDER_PRESETS_MINUTES)[number];

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  company: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: AccountStatus;
  timezone: string;
  created_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  locked_reason: string | null;
  suspended_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAccess {
  user_id: string;
  plan_id: string | null;
  license_status: LicenseStatus;
  trial_started_at: string;
  trial_ends_at: string;
  activated_at: string | null;
  activated_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  notes: string | null;
  updated_at: string;
}

export interface UserWithAccess extends Profile {
  access: UserAccess | null;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_calendars: number | null;
  max_shared_members: number | null;
  is_default: boolean;
  created_at: string;
}

export interface Calendar {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  type: CalendarType;
  color: string;
  timezone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarMember {
  id: string;
  calendar_id: string;
  user_id: string;
  permission: CalendarPermission;
  invited_by: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  created_by: string;
  title: string;
  description: string | null;
  location: string | null;
  video_link: string | null;
  category: string | null;
  color: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  status: EventStatus;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  response_status: ParticipantResponse;
  invited_at: string;
  responded_at: string | null;
}

export interface Meeting {
  id: string;
  event_id: string | null;
  calendar_id: string | null;
  organizer_id: string;
  title: string;
  description: string | null;
  location: string | null;
  video_link: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  status: MeetingStatus;
  notes: string | null;
  rescheduled_from: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  role: MeetingRole;
  response_status: ParticipantResponse;
  responded_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  calendar_id: string | null;
  event_id: string | null;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  entity_type: ReminderEntityType;
  entity_id: string;
  minutes_before: number | null;
  custom_remind_at: string | null;
  channels: NotificationChannel[];
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  telegram_enabled: boolean;
  meeting_notifications: boolean;
  task_notifications: boolean;
  reminder_notifications: boolean;
  trial_notifications: boolean;
  updated_at: string;
}

export interface TelegramConnection {
  user_id: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  connect_token: string | null;
  connect_token_expires_at: string | null;
  is_active: boolean;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  scheduled_at: string;
  sent_at: string | null;
  status: NotificationStatus;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  dedupe_key: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  owner_id: string;
  entity_type: NoteEntityType;
  entity_id: string | null;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminDashboardStats {
  total_users: number;
  active_users: number;
  trial_users: number;
  expired_users: number;
  locked_users: number;
  clients: number;
  employees: number;
  upcoming_meetings: number;
  notification_failures: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
