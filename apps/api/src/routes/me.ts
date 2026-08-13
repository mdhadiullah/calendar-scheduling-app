import { Router } from 'express';
import { trialDaysRemaining } from '@calendar-app/shared';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export const meRouter = Router();
meRouter.use(authenticate);

// Reachable even when a trial has expired, so the frontend can show the
// trial-expired screen with accurate account details.
meRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { profile, access } = req.user!;
    res.json({
      profile,
      access,
      trialDaysRemaining: access ? trialDaysRemaining(access) : null,
    });
  })
);

meRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const { full_name, mobile, company, avatar_url, timezone } = req.body ?? {};
    const { data, error } = await req.user!.supabase
      .from('profiles')
      .update({ full_name, mobile, company, avatar_url, timezone })
      .eq('id', req.user!.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ profile: data });
  })
);

meRouter.get(
  '/me/notification-preferences',
  asyncHandler(async (req, res) => {
    const { data } = await req.user!.supabase.from('notification_preferences').select('*').eq('user_id', req.user!.id).maybeSingle();
    res.json({
      preferences: data ?? {
        user_id: req.user!.id,
        in_app_enabled: true,
        email_enabled: true,
        telegram_enabled: false,
        meeting_notifications: true,
        task_notifications: true,
        reminder_notifications: true,
        trial_notifications: true,
      },
    });
  })
);

meRouter.put(
  '/me/notification-preferences',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .upsert({ user_id: req.user!.id, ...req.body }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    res.json({ preferences: data });
  })
);
