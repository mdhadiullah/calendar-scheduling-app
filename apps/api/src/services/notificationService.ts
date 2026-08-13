import type { NotificationChannel, NotificationType } from '@calendar-app/shared';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { sendEmail } from './emailService';
import { sendTelegramMessage } from './telegramService';
import { env } from '../lib/env';
import * as templates from './emailTemplates';

export interface QueueNotificationInput {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
  /** Unique key preventing duplicate notifications for the same event+channel+recipient. */
  dedupeKey: string;
}

/**
 * Inserts a PENDING notification row. Relies on the unique constraint on
 * `dedupe_key` to make this operation idempotent — calling it twice for the
 * same logical notification is a safe no-op.
 */
export async function queueNotification(input: QueueNotificationInput) {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    channel: input.channel,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
    scheduled_at: (input.scheduledAt ?? new Date()).toISOString(),
    dedupe_key: input.dedupeKey,
  });

  // 23505 = unique_violation -> already queued, treat as success (idempotent).
  if (error && (error as { code?: string }).code !== '23505') {
    logger.error({ error, input }, 'Failed to queue notification');
    throw error;
  }
}

/** Queue the same notification across every channel the user has enabled. */
export async function queueMultiChannel(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
  dedupeKeyBase: string;
}) {
  const { data: prefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', params.userId)
    .maybeSingle();

  const channels: NotificationChannel[] = ['IN_APP'];
  if (prefs?.email_enabled ?? true) channels.push('EMAIL');
  if (prefs?.telegram_enabled) channels.push('TELEGRAM');

  await Promise.all(
    channels.map((channel) =>
      queueNotification({
        ...params,
        channel,
        dedupeKey: `${params.dedupeKeyBase}:${channel}`,
      })
    )
  );
}

const MAX_BATCH = 50; // keep each cron invocation light on a 2GB RAM host

/**
 * Processes up to MAX_BATCH due PENDING notifications: marks them
 * PROCESSING, dispatches via the right channel, then marks SENT or FAILED
 * (with retry_count bump). Designed to be safely re-invoked repeatedly by
 * an external scheduler — already-SENT rows are never re-sent.
 */
export async function processPendingNotifications() {
  const { data: due, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('status', 'PENDING')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(MAX_BATCH);

  if (error) throw error;
  if (!due || due.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const notification of due) {
    await supabaseAdmin.from('notifications').update({ status: 'PROCESSING' }).eq('id', notification.id);

    let result: { ok: boolean; error?: string };
    try {
      if (notification.channel === 'IN_APP') {
        // In-app notifications are "delivered" simply by existing in the
        // table; the frontend reads them directly (subject to RLS).
        result = { ok: true };
      } else if (notification.channel === 'EMAIL') {
        const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', notification.user_id).single();
        if (!profile?.email) {
          result = { ok: false, error: 'No email on file for user' };
        } else {
          const emailResult = await sendEmail({
            to: profile.email,
            subject: notification.title,
            html: renderTemplatedEmail(profile.full_name ?? 'there', notification),
          });
          result = emailResult.ok ? { ok: true } : { ok: false, error: emailResult.error };
        }
      } else if (notification.channel === 'TELEGRAM') {
        const { data: telegram } = await supabaseAdmin
          .from('telegram_connections')
          .select('telegram_chat_id, is_active')
          .eq('user_id', notification.user_id)
          .maybeSingle();
        if (!telegram?.telegram_chat_id || !telegram.is_active) {
          result = { ok: false, error: 'User has no active Telegram connection' };
        } else {
          const tgResult = await sendTelegramMessage(telegram.telegram_chat_id, `<b>${notification.title}</b>\n${notification.body}`);
          result = tgResult.ok ? { ok: true } : { ok: false, error: tgResult.error };
        }
      } else {
        result = { ok: false, error: `Unknown channel ${notification.channel}` };
      }
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : 'Unknown dispatch error' };
    }

    if (result.ok) {
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'SENT', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', notification.id);
      sent += 1;
    } else {
      const retryCount = (notification.retry_count ?? 0) + 1;
      const exhausted = retryCount >= (notification.max_retries ?? 3);
      await supabaseAdmin
        .from('notifications')
        .update({
          status: exhausted ? 'FAILED' : 'PENDING',
          retry_count: retryCount,
          error_message: result.error ?? 'Unknown error',
          // Simple backoff: retry 5 minutes later.
          scheduled_at: exhausted ? notification.scheduled_at : new Date(Date.now() + 5 * 60_000).toISOString(),
        })
        .eq('id', notification.id);
      failed += 1;
    }
  }

  return { processed: due.length, sent, failed };
}

function renderGenericEmail(recipientName: string, title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;">
    <p>Hi ${recipientName},</p>
    <h2 style="margin:8px 0;">${title}</h2>
    <p>${body}</p>
    <p style="font-size:12px;color:#697386;margin-top:16px;">Manage your notification preferences in Settings &gt; Notifications at ${env.APP_URL}.</p>
   </body></html>`;
}

/**
 * Picks a branded template for known notification types (using metadata
 * supplied at queue time); falls back to a generic wrapper around the
 * notification's title/body for anything else.
 */
function renderTemplatedEmail(recipientName: string, notification: { type: NotificationType; title: string; body: string; metadata: Record<string, unknown> }): string {
  const m = notification.metadata ?? {};
  const base = { recipientName, appUrl: env.APP_URL };
  try {
    switch (notification.type) {
      case 'MEETING_INVITE':
        return templates.meetingInvitationEmail({ ...base, meetingTitle: String(m.meetingTitle ?? notification.title), startAt: String(m.startAt ?? ''), location: m.location ? String(m.location) : undefined, meetingUrl: String(m.meetingUrl ?? env.APP_URL) });
      case 'MEETING_REMINDER':
        return templates.meetingReminderEmail({ ...base, meetingTitle: String(m.meetingTitle ?? notification.title), startAt: String(m.startAt ?? ''), minutesBefore: Number(m.minutesBefore ?? 0), meetingUrl: String(m.meetingUrl ?? env.APP_URL) });
      case 'MEETING_CANCELLED':
        return templates.meetingCancelledEmail({ ...base, meetingTitle: String(m.meetingTitle ?? notification.title), startAt: String(m.startAt ?? ''), reason: m.reason ? String(m.reason) : undefined });
      case 'MEETING_CHANGED':
        return templates.meetingRescheduledEmail({ ...base, meetingTitle: String(m.meetingTitle ?? notification.title), oldStartAt: String(m.oldStartAt ?? ''), newStartAt: String(m.newStartAt ?? ''), meetingUrl: String(m.meetingUrl ?? env.APP_URL) });
      case 'TRIAL_EXPIRING':
        return templates.trialExpiringEmail({ ...base, daysRemaining: Number(m.daysRemaining ?? 0) });
      case 'TRIAL_EXPIRED':
        return templates.trialExpiredEmail(base);
      case 'ACCOUNT_ACTIVATED':
        return templates.accountActivatedEmail(base);
      case 'ACCOUNT_LOCKED':
        return templates.accountLockedEmail(base);
      case 'ACCOUNT_UNLOCKED':
        return templates.accountUnlockedEmail(base);
      default:
        return renderGenericEmail(recipientName, notification.title, notification.body);
    }
  } catch {
    return renderGenericEmail(recipientName, notification.title, notification.body);
  }
}

/**
 * Expands upcoming reminders (and default meeting reminders) into concrete
 * `notifications` rows, looking ahead a fixed window. Safe to call
 * repeatedly — dedupe_key prevents duplicate rows.
 */
export async function generateReminderNotifications(lookaheadMinutes = 60) {
  const now = new Date();
  const horizon = new Date(now.getTime() + lookaheadMinutes * 60_000);

  const { data: reminders, error } = await supabaseAdmin.from('reminders').select('*');
  if (error) throw error;

  let queued = 0;

  for (const reminder of reminders ?? []) {
    const entity = await fetchReminderEntity(reminder.entity_type, reminder.entity_id);
    if (!entity) continue;

    const fireAt = reminder.custom_remind_at
      ? new Date(reminder.custom_remind_at)
      : new Date(new Date(entity.start_at).getTime() - (reminder.minutes_before ?? 0) * 60_000);

    if (fireAt < now || fireAt > horizon) continue;

    const type: NotificationType = reminder.entity_type === 'TASK' ? 'TASK_REMINDER' : reminder.entity_type === 'MEETING' ? 'MEETING_REMINDER' : 'EVENT_REMINDER';

    for (const channel of reminder.channels as NotificationChannel[]) {
      await queueNotification({
        userId: reminder.user_id,
        type,
        channel,
        title: `Reminder: ${entity.title}`,
        body: `${entity.title} starts at ${new Date(entity.start_at).toLocaleString()}`,
        entityType: reminder.entity_type,
        entityId: reminder.entity_id,
        scheduledAt: fireAt,
        dedupeKey: `reminder:${reminder.id}:${fireAt.toISOString()}:${channel}`,
      });
      queued += 1;
    }
  }

  return { queued };
}

async function fetchReminderEntity(entityType: 'EVENT' | 'MEETING' | 'TASK', entityId: string): Promise<{ title: string; start_at: string } | null> {
  if (entityType === 'EVENT') {
    const { data } = await supabaseAdmin.from('events').select('title, start_at').eq('id', entityId).maybeSingle();
    return data;
  }
  if (entityType === 'MEETING') {
    const { data } = await supabaseAdmin.from('meetings').select('title, start_at').eq('id', entityId).maybeSingle();
    return data;
  }
  const { data } = await supabaseAdmin.from('tasks').select('title, due_at').eq('id', entityId).maybeSingle();
  return data ? { title: data.title, start_at: data.due_at } : null;
}
