import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiHttpError } from '../middleware/errorHandler';

export const searchRouter = Router();
searchRouter.use(authenticate);

const RESULT_LIMIT = 8;

// GET /api/search?q=... — global search across events, meetings, tasks,
// users/clients, and notes. Each sub-query runs through the caller's own
// RLS-scoped client, so results never leak data the user can't see.
searchRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) throw new ApiHttpError(400, 'QUERY_TOO_SHORT', 'Search query must be at least 2 characters');

    const like = `%${q}%`;
    const supabase = req.user!.supabase;

    const [events, meetings, tasks, users, notes] = await Promise.all([
      supabase.from('events').select('id, title, start_at, calendar_id').ilike('title', like).limit(RESULT_LIMIT),
      supabase.from('meetings').select('id, title, start_at, status').ilike('title', like).limit(RESULT_LIMIT),
      supabase.from('tasks').select('id, title, status, due_at').ilike('title', like).limit(RESULT_LIMIT),
      supabase.from('profiles').select('id, full_name, email, role').or(`full_name.ilike.${like},email.ilike.${like},company.ilike.${like}`).limit(RESULT_LIMIT),
      supabase.from('notes').select('id, title, content, entity_type, entity_id').ilike('content', like).limit(RESULT_LIMIT),
    ]);

    res.json({
      events: events.data ?? [],
      meetings: meetings.data ?? [],
      tasks: tasks.data ?? [],
      users: users.data ?? [],
      notes: notes.data ?? [],
    });
  })
);
