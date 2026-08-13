import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermitted } from '../middleware/requirePermitted';
import { asyncHandler } from '../middleware/errorHandler';

export const notesRouter = Router();
notesRouter.use(authenticate);

notesRouter.get(
  '/notes',
  asyncHandler(async (req, res) => {
    let query = req.user!.supabase.from('notes').select('*').order('updated_at', { ascending: false });
    if (req.query.entityType && req.query.entityId) {
      query = query.eq('entity_type', String(req.query.entityType)).eq('entity_id', String(req.query.entityId));
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);

const noteSchema = z.object({
  entity_type: z.enum(['EVENT', 'MEETING', 'TASK', 'GENERAL']).default('GENERAL'),
  entity_id: z.string().uuid().optional(),
  title: z.string().optional(),
  content: z.string().min(1),
});

notesRouter.post(
  '/notes',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = noteSchema.parse(req.body);
    const { data, error } = await req.user!.supabase.from('notes').insert({ ...input, owner_id: req.user!.id }).select().single();
    if (error) throw error;
    res.status(201).json({ note: data });
  })
);

notesRouter.patch(
  '/notes/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = noteSchema.partial().parse(req.body);
    const { data, error } = await req.user!.supabase.from('notes').update(input).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ note: data });
  })
);

notesRouter.delete(
  '/notes/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase.from('notes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);
