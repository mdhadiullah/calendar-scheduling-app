import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// Reachable regardless of license status so a locked/expired user can still
// see why (e.g. an ACCOUNT_LOCKED / TRIAL_EXPIRED in-app notification).
notificationsRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = req.user!.supabase.from('notifications').select('*', { count: 'exact' }).eq('channel', 'IN_APP').order('scheduled_at', { ascending: false });
    if (req.query.unread === 'true') query = query.is('sent_at', null);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ data, total: count ?? 0, page, pageSize });
  })
);

notificationsRouter.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    const { data, error } = await req.user!.supabase
      .from('notifications')
      .update({ status: 'SENT', sent_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ notification: data });
  })
);
