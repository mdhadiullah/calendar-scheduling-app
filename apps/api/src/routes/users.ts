import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const usersRouter = Router();
usersRouter.use(authenticate);

// Lightweight directory used by participant/assignee pickers across the
// app (invite to meeting, assign task, share calendar). Any authenticated
// user may list colleagues' basic info — see profiles_select_authenticated
// RLS policy. Sensitive admin-only fields (license, lock reason) are
// intentionally omitted here; use /api/admin/users for that.
usersRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    let query = req.user!.supabase.from('profiles').select('id, full_name, email, avatar_url, role').order('full_name', { ascending: true }).limit(50);
    if (req.query.q) {
      const q = String(req.query.q);
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);
