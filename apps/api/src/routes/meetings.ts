import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermitted } from '../middleware/requirePermitted';
import { asyncHandler, ApiHttpError } from '../middleware/errorHandler';
import { queueMultiChannel } from '../services/notificationService';

export const meetingsRouter = Router();
meetingsRouter.use(authenticate);

meetingsRouter.get(
  '/meetings',
  asyncHandler(async (req, res) => {
    let query = req.user!.supabase
      .from('meetings')
      .select('*, meeting_participants(user_id, role, response_status)')
      .order('start_at', { ascending: true });

    if (req.query.status) query = query.eq('status', String(req.query.status));
    if (req.query.start) query = query.gte('end_at', String(req.query.start));
    if (req.query.end) query = query.lte('start_at', String(req.query.end));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);

meetingsRouter.get(
  '/meetings/:id',
  asyncHandler(async (req, res) => {
    const { data, error } = await req.user!.supabase
      .from('meetings')
      .select('*, meeting_participants(*)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw new ApiHttpError(404, 'NOT_FOUND', 'Meeting not found');
    res.json({ meeting: data });
  })
);

const createMeetingSchema = z.object({
  calendar_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  video_link: z.string().optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  timezone: z.string().default('UTC'),
  participant_ids: z.array(z.string().uuid()).default([]),
});

meetingsRouter.post(
  '/meetings',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = createMeetingSchema.parse(req.body);
    const { participant_ids, ...fields } = input;

    const { data: meeting, error } = await req.user!.supabase
      .from('meetings')
      .insert({ ...fields, organizer_id: req.user!.id })
      .select()
      .single();
    if (error) throw error;

    await req.user!.supabase.from('meeting_participants').insert({ meeting_id: meeting.id, user_id: req.user!.id, role: 'ORGANIZER', response_status: 'ACCEPTED', responded_at: new Date().toISOString() });

    if (participant_ids.length > 0) {
      await req.user!.supabase.from('meeting_participants').insert(participant_ids.map((user_id) => ({ meeting_id: meeting.id, user_id, role: 'ATTENDEE' })));

      await Promise.all(
        participant_ids.map((userId) =>
          queueMultiChannel({
            userId,
            type: 'MEETING_INVITE',
            title: `Invitation: ${meeting.title}`,
            body: `You've been invited to ${meeting.title} at ${new Date(meeting.start_at).toLocaleString()}.`,
            entityType: 'MEETING',
            entityId: meeting.id,
            metadata: { meetingTitle: meeting.title, startAt: new Date(meeting.start_at).toLocaleString(), location: meeting.location, meetingUrl: meeting.video_link },
            dedupeKeyBase: `meeting-invite:${meeting.id}:${userId}`,
          })
        )
      );
    }

    res.status(201).json({ meeting });
  })
);

meetingsRouter.patch(
  '/meetings/:id',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const input = createMeetingSchema.partial().omit({ participant_ids: true }).parse(req.body);
    const { data, error } = await req.user!.supabase.from('meetings').update(input).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ meeting: data });
  })
);

meetingsRouter.post(
  '/meetings/:id/reschedule',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const { start_at, end_at } = z.object({ start_at: z.string().datetime(), end_at: z.string().datetime() }).parse(req.body);

    const { data: existing } = await req.user!.supabase.from('meetings').select('*').eq('id', req.params.id).single();
    if (!existing) throw new ApiHttpError(404, 'NOT_FOUND', 'Meeting not found');

    const { data: meeting, error } = await req.user!.supabase
      .from('meetings')
      .update({ start_at, end_at, status: 'RESCHEDULED', rescheduled_from: existing.start_at })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    const { data: participants } = await req.user!.supabase.from('meeting_participants').select('user_id').eq('meeting_id', req.params.id);
    await Promise.all(
      (participants ?? [])
        .filter((p) => p.user_id !== req.user!.id)
        .map((p) =>
          queueMultiChannel({
            userId: p.user_id,
            type: 'MEETING_CHANGED',
            title: `Rescheduled: ${meeting.title}`,
            body: `${meeting.title} moved to ${new Date(start_at).toLocaleString()}.`,
            entityType: 'MEETING',
            entityId: meeting.id,
            metadata: { meetingTitle: meeting.title, oldStartAt: new Date(existing.start_at).toLocaleString(), newStartAt: new Date(start_at).toLocaleString(), meetingUrl: meeting.video_link },
            dedupeKeyBase: `meeting-rescheduled:${meeting.id}:${p.user_id}:${start_at}`,
          })
        )
    );

    res.json({ meeting });
  })
);

meetingsRouter.post(
  '/meetings/:id/cancel',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

    const { data: meeting, error } = await req.user!.supabase
      .from('meetings')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancelled_reason: reason })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    const { data: participants } = await req.user!.supabase.from('meeting_participants').select('user_id').eq('meeting_id', req.params.id);
    await Promise.all(
      (participants ?? [])
        .filter((p) => p.user_id !== req.user!.id)
        .map((p) =>
          queueMultiChannel({
            userId: p.user_id,
            type: 'MEETING_CANCELLED',
            title: `Cancelled: ${meeting.title}`,
            body: reason ?? `${meeting.title} has been cancelled.`,
            entityType: 'MEETING',
            entityId: meeting.id,
            metadata: { meetingTitle: meeting.title, startAt: new Date(meeting.start_at).toLocaleString(), reason },
            dedupeKeyBase: `meeting-cancelled:${meeting.id}:${p.user_id}`,
          })
        )
    );

    res.json({ meeting });
  })
);

meetingsRouter.patch(
  '/meetings/:id/respond',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const response_status = z.enum(['ACCEPTED', 'DECLINED', 'TENTATIVE']).parse(req.body?.response_status);
    const { data, error } = await req.user!.supabase
      .from('meeting_participants')
      .update({ response_status, responded_at: new Date().toISOString() })
      .eq('meeting_id', req.params.id)
      .eq('user_id', req.user!.id)
      .select()
      .single();
    if (error) throw error;

    const { data: meeting } = await req.user!.supabase.from('meetings').select('title, organizer_id').eq('id', req.params.id).single();
    if (meeting && meeting.organizer_id !== req.user!.id) {
      const typeMap = { ACCEPTED: 'MEETING_ACCEPTED', DECLINED: 'MEETING_DECLINED', TENTATIVE: 'MEETING_TENTATIVE' } as const;
      await queueMultiChannel({
        userId: meeting.organizer_id,
        type: typeMap[response_status],
        title: `${req.user!.profile.full_name} ${response_status.toLowerCase()} ${meeting.title}`,
        body: `${req.user!.profile.full_name} responded "${response_status}" to ${meeting.title}.`,
        entityType: 'MEETING',
        entityId: req.params.id,
        dedupeKeyBase: `meeting-response:${req.params.id}:${req.user!.id}:${response_status}`,
      });
    }

    res.json({ participant: data });
  })
);

meetingsRouter.patch(
  '/meetings/:id/notes',
  requirePermitted,
  asyncHandler(async (req, res) => {
    const notes = z.string().parse(req.body?.notes ?? '');
    const { data, error } = await req.user!.supabase.from('meetings').update({ notes }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ meeting: data });
  })
);
