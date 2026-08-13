import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermitted } from '../middleware/requirePermitted';
import { asyncHandler, ApiHttpError } from '../middleware/errorHandler';
import { queueMultiChannel } from '../services/notificationService';

export const eventsRouter = Router();
eventsRouter.use(authenticate);

// GET /api/events?start=...&end=...&calendarId=... — used by all calendar
// views (day/3day/week/month/agenda/year); the frontend computes the range.
eventsRouter.get(
  '/events',
  asyncHandler(async (req, res) => {
    const { start, end, calendarId } = req.query;
    let query = req.user!.supabase.from('events').select('*, event_participants(user_id, response_status)').order('start_at', { ascending: true });

    if (start) query = query.gte('end_at', String(start));
    if (end) query = query.lte('start_at', String(end));
    if (calendarId) query = query.eq('calendar_id', String(calendarId));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);

const eventSchema = z.object({
  calendar_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  video_link: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  all_day: z.boolean().default(false),
  timezone: z.string().default('UTC'),
  recurrence_rule: z.string().optional(),
  participant_ids: z.array(z.string().uuid()).default([]),
});

eventsRouter.post(
  '/events',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = eventSchema.parse(req.body);
    const { participant_ids, ...eventFields } = input;

    const { data: event, error } = await req.user!.supabase
      .from('events')
      .insert({ ...eventFields, created_by: req.user!.id })
      .select()
      .single();
    if (error) throw error;

    if (participant_ids.length > 0) {
      await req.user!.supabase.from('event_participants').insert(participant_ids.map((user_id) => ({ event_id: event.id, user_id })));
    }

    res.status(201).json({ event });
  })
);

const updateEventSchema = eventSchema.partial().omit({ participant_ids: true });

eventsRouter.patch(
  '/events/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = updateEventSchema.parse(req.body);
    const { data, error } = await req.user!.supabase.from('events').update(input).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) throw new ApiHttpError(404, 'NOT_FOUND', 'Event not found');
    res.json({ event: data });
  })
);

// Drag/drop and resize both reduce to updating start_at/end_at.
eventsRouter.patch(
  '/events/:id/move',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { start_at, end_at } = z.object({ start_at: z.string().datetime(), end_at: z.string().datetime() }).parse(req.body);
    const { data, error } = await req.user!.supabase.from('events').update({ start_at, end_at }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ event: data });
  })
);

eventsRouter.delete(
  '/events/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase.from('events').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);

// --- Participants ------------------------------------------------------------
eventsRouter.post(
  '/events/:id/invite',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const userIds = z.array(z.string().uuid()).min(1).parse(req.body?.user_ids);
    const { data, error } = await req.user!.supabase
      .from('event_participants')
      .insert(userIds.map((user_id) => ({ event_id: req.params.id, user_id })))
      .select();
    if (error) throw error;

    const { data: event } = await req.user!.supabase.from('events').select('title, start_at').eq('id', req.params.id).single();
    if (event) {
      await Promise.all(
        userIds.map((userId) =>
          queueMultiChannel({
            userId,
            type: 'MEETING_INVITE',
            title: `Invitation: ${event.title}`,
            body: `You've been invited to ${event.title} at ${new Date(event.start_at).toLocaleString()}.`,
            entityType: 'EVENT',
            entityId: req.params.id,
            dedupeKeyBase: `event-invite:${req.params.id}:${userId}`,
          })
        )
      );
    }

    res.status(201).json({ participants: data });
  })
);

eventsRouter.patch(
  '/events/:id/respond',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const response_status = z.enum(['ACCEPTED', 'DECLINED', 'TENTATIVE']).parse(req.body?.response_status);
    const { data, error } = await req.user!.supabase
      .from('event_participants')
      .update({ response_status, responded_at: new Date().toISOString() })
      .eq('event_id', req.params.id)
      .eq('user_id', req.user!.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ participant: data });
  })
);
