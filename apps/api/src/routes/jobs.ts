import { Router } from 'express';
import { requireCronSecret } from '../middleware/requireCronSecret';
import { asyncHandler } from '../middleware/errorHandler';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { processPendingNotifications, generateReminderNotifications, queueMultiChannel } from '../services/notificationService';
import { logger } from '../lib/logger';

export const jobsRouter = Router();
jobsRouter.use(requireCronSecret);

/**
 * All /api/jobs/* endpoints are short-running, idempotent, and safe to call
 * repeatedly on any schedule (e.g. every 1-5 minutes) from Hostnin's
 * scheduled-task feature or any external HTTP cron service. None of them
 * assume a long-lived background process — this satisfies spec section 13
 * ("Do NOT depend on a continuously running Node.js process").
 *
 * Suggested schedule (see docs/deployment.md):
 *   POST /api/jobs/generate-reminders   every 5 minutes
 *   POST /api/jobs/process-notifications every 1-2 minutes
 *   POST /api/jobs/expire-trials         every 1 hour
 *   POST /api/jobs/trial-warnings        once a day
 */

jobsRouter.post(
  '/jobs/generate-reminders',
  asyncHandler(async (_req, res) => {
    const result = await generateReminderNotifications(60);
    res.json(result);
  })
);

jobsRouter.post(
  '/jobs/process-notifications',
  asyncHandler(async (_req, res) => {
    const result = await processPendingNotifications();
    res.json(result);
  })
);

jobsRouter.post(
  '/jobs/expire-trials',
  asyncHandler(async (_req, res) => {
    const { data: expiring } = await supabaseAdmin
      .from('user_access')
      .select('user_id')
      .eq('license_status', 'TRIAL')
      .lt('trial_ends_at', new Date().toISOString());

    const { data: affected, error } = await supabaseAdmin.rpc('expire_trials');
    if (error) throw error;

    for (const row of expiring ?? []) {
      await queueMultiChannel({
        userId: row.user_id,
        type: 'TRIAL_EXPIRED',
        title: 'Your trial has ended',
        body: 'Your 15-day trial has ended. Contact your administrator to activate your account.',
        dedupeKeyBase: `trial-expired:${row.user_id}`,
      });
    }

    logger.info({ affected }, 'expire-trials job completed');
    res.json({ expired: affected ?? 0 });
  })
);

jobsRouter.post(
  '/jobs/trial-warnings',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60_000);

    const { data: soon, error } = await supabaseAdmin
      .from('user_access')
      .select('user_id, trial_ends_at')
      .eq('license_status', 'TRIAL')
      .lte('trial_ends_at', in3Days.toISOString())
      .gt('trial_ends_at', now.toISOString());
    if (error) throw error;

    const todayKey = now.toISOString().slice(0, 10);

    for (const row of soon ?? []) {
      const daysRemaining = Math.max(0, Math.ceil((new Date(row.trial_ends_at).getTime() - now.getTime()) / 86_400_000));
      await queueMultiChannel({
        userId: row.user_id,
        type: 'TRIAL_EXPIRING',
        title: `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        body: 'Contact your administrator to activate your full account and avoid losing access.',
        metadata: { daysRemaining },
        // one warning per user per day, even if the job runs more than once
        dedupeKeyBase: `trial-warning:${row.user_id}:${todayKey}`,
      });
    }

    res.json({ warned: soon?.length ?? 0 });
  })
);

// Convenience: run every job in sequence in one call, useful for hosts that
// only allow a single scheduled task slot.
jobsRouter.post(
  '/jobs/run-all',
  asyncHandler(async (_req, res) => {
    const reminders = await generateReminderNotifications(60);
    const notifications = await processPendingNotifications();
    res.json({ reminders, notifications });
  })
);
