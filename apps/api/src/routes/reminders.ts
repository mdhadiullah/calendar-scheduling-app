import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermitted } from '../middleware/requirePermitted';
import { asyncHandler } from '../middleware/errorHandler';

export const remindersRouter = Router();
remindersRouter.use(authenticate);

remindersRouter.get(
  '/reminders',
  asyncHandler(async (req, res) => {
    let query = req.user!.supabase.from('reminders').select('*').order('created_at', { ascending: false });
    if (req.query.entityType && req.query.entityId) {
      query = query.eq('entity_type', String(req.query.entityType)).eq('entity_id', String(req.query.entityId));
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);

const reminderSchema = z
  .object({
    entity_type: z.enum(['EVENT', 'MEETING', 'TASK']),
    entity_id: z.string().uuid(),
    minutes_before: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60), z.literal(1440), z.number().int().positive()]).optional(),
    custom_remind_at: z.string().datetime().optional(),
    channels: z.array(z.enum(['IN_APP', 'EMAIL', 'TELEGRAM'])).default(['IN_APP']),
  })
  .refine((v) => v.minutes_before !== undefined || v.custom_remind_at !== undefined, {
    message: 'Provide either minutes_before or custom_remind_at',
  });

remindersRouter.post(
  '/reminders',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = reminderSchema.parse(req.body);
    const { data, error } = await req.user!.supabase.from('reminders').insert({ ...input, user_id: req.user!.id }).select().single();
    if (error) throw error;
    res.status(201).json({ reminder: data });
  })
);

remindersRouter.delete(
  '/reminders/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase.from('reminders').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);
