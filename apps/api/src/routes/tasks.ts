import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermitted } from '../middleware/requirePermitted';
import { asyncHandler } from '../middleware/errorHandler';
import { queueMultiChannel } from '../services/notificationService';

export const tasksRouter = Router();
tasksRouter.use(authenticate);

tasksRouter.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    let query = req.user!.supabase.from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false });
    if (req.query.status) query = query.eq('status', String(req.query.status));
    if (req.query.assignedToMe === 'true') query = query.eq('assigned_to', req.user!.id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);

const taskSchema = z.object({
  calendar_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_at: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

tasksRouter.post(
  '/tasks',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = taskSchema.parse(req.body);
    const { data, error } = await req.user!.supabase.from('tasks').insert({ ...input, created_by: req.user!.id }).select().single();
    if (error) throw error;

    if (input.assigned_to && input.assigned_to !== req.user!.id) {
      await queueMultiChannel({
        userId: input.assigned_to,
        type: 'TASK_ASSIGNED',
        title: `New task: ${data.title}`,
        body: `You've been assigned "${data.title}"${input.due_at ? ` due ${new Date(input.due_at).toLocaleString()}` : ''}.`,
        entityType: 'TASK',
        entityId: data.id,
        dedupeKeyBase: `task-assigned:${data.id}`,
      });
    }

    res.status(201).json({ task: data });
  })
);

const updateTaskSchema = taskSchema.partial().extend({
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

tasksRouter.patch(
  '/tasks/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = updateTaskSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...input };
    if (input.status === 'COMPLETED') patch.completed_at = new Date().toISOString();

    const { data, error } = await req.user!.supabase.from('tasks').update(patch).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ task: data });
  })
);

tasksRouter.delete(
  '/tasks/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);
