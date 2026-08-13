import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermitted } from '../middleware/requirePermitted';
import { asyncHandler } from '../middleware/errorHandler';

export const calendarsRouter = Router();
calendarsRouter.use(authenticate);

calendarsRouter.get(
  '/calendars',
  asyncHandler(async (req, res) => {
    // Calendars the user owns or is a member of (RLS enforces this filter
    // automatically, but we also select via the join for clarity).
    const { data, error } = await req.user!.supabase
      .from('calendars')
      .select('*, calendar_members(user_id, permission)')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ data });
  })
);

const createCalendarSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PERSONAL', 'TEAM', 'SHARED']).default('PERSONAL'),
  color: z.string().default('#4F46E5'),
  timezone: z.string().default('UTC'),
});

calendarsRouter.post(
  '/calendars',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = createCalendarSchema.parse(req.body);
    const { data, error } = await req.user!.supabase
      .from('calendars')
      .insert({ ...input, owner_id: req.user!.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ calendar: data });
  })
);

calendarsRouter.patch(
  '/calendars/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = createCalendarSchema.partial().parse(req.body);
    const { data, error } = await req.user!.supabase.from('calendars').update(input).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ calendar: data });
  })
);

calendarsRouter.delete(
  '/calendars/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase.from('calendars').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);

// --- Members / sharing -------------------------------------------------------
const addMemberSchema = z.object({
  user_id: z.string().uuid(),
  permission: z.enum(['OWNER', 'EDITOR', 'VIEWER']).default('VIEWER'),
});

calendarsRouter.post(
  '/calendars/:id/members',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = addMemberSchema.parse(req.body);
    const { data, error } = await req.user!.supabase
      .from('calendar_members')
      .upsert({ calendar_id: req.params.id, ...input, invited_by: req.user!.id }, { onConflict: 'calendar_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ member: data });
  })
);

calendarsRouter.delete(
  '/calendars/:id/members/:userId',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase.from('calendar_members').delete().eq('calendar_id', req.params.id).eq('user_id', req.params.userId);
    if (error) throw error;
    res.status(204).end();
  })
);
