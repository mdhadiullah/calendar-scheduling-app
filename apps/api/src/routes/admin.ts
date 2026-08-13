import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireRole';
import { asyncHandler, ApiHttpError } from '../middleware/errorHandler';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { recordAuditLog } from '../services/auditService';
import { queueMultiChannel } from '../services/notificationService';
import { env } from '../lib/env';
import { accountCreatedEmail } from '../services/emailTemplates';
import { sendEmail } from '../services/emailService';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------
adminRouter.get(
  '/admin/dashboard',
  asyncHandler(async (_req, res) => {
    const [{ count: total_users }, { count: clients }, { count: employees }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'CLIENT'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'EMPLOYEE'),
    ]);

    const [{ count: active_users }, { count: locked_users }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'LOCKED'),
    ]);

    const [{ count: trial_users }, { count: expired_users }] = await Promise.all([
      supabaseAdmin.from('user_access').select('*', { count: 'exact', head: true }).eq('license_status', 'TRIAL'),
      supabaseAdmin.from('user_access').select('*', { count: 'exact', head: true }).eq('license_status', 'EXPIRED'),
    ]);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    const { count: upcoming_meetings } = await supabaseAdmin
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .gte('start_at', now.toISOString())
      .lte('start_at', in7Days.toISOString())
      .neq('status', 'CANCELLED');

    const { count: notification_failures } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'FAILED');

    res.json({
      total_users: total_users ?? 0,
      active_users: active_users ?? 0,
      trial_users: trial_users ?? 0,
      expired_users: expired_users ?? 0,
      locked_users: locked_users ?? 0,
      clients: clients ?? 0,
      employees: employees ?? 0,
      upcoming_meetings: upcoming_meetings ?? 0,
      notification_failures: notification_failures ?? 0,
    });
  })
);

// ---------------------------------------------------------------------------
// User list / detail
// ---------------------------------------------------------------------------
adminRouter.get(
  '/admin/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin.from('profiles').select('*, user_access(*)', { count: 'exact' }).order('created_at', { ascending: false });

    if (req.query.role) query = query.eq('role', String(req.query.role));
    if (req.query.status) query = query.eq('status', String(req.query.status));
    if (req.query.q) {
      const q = String(req.query.q);
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    res.json({ data, total: count ?? 0, page, pageSize });
  })
);

adminRouter.get(
  '/admin/users/:id',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin.from('profiles').select('*, user_access(*)').eq('id', req.params.id).single();
    if (error || !data) throw new ApiHttpError(404, 'NOT_FOUND', 'User not found');
    res.json({ user: data });
  })
);

// ---------------------------------------------------------------------------
// Create user / client (admin provisioning — no self-registration)
// ---------------------------------------------------------------------------
const createUserSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional(),
  company: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT']),
});

adminRouter.post(
  '/admin/users',
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);

    // Temporary random password — never communicated to the user. They set
    // their own password via the secure activation link below.
    const tempPassword = randomUUID() + randomUUID();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name,
        role: input.role,
        created_by: req.user!.id,
      },
    });
    if (createError || !created?.user) {
      throw new ApiHttpError(400, 'USER_CREATE_FAILED', createError?.message ?? 'Failed to create user');
    }

    // Fill in mobile/company (not part of auth metadata trigger).
    await supabaseAdmin.from('profiles').update({ mobile: input.mobile ?? null, company: input.company ?? null }).eq('id', created.user.id);

    // Generate a one-time, expiring account-setup link (Supabase Auth
    // recovery link doubles as a secure "set your password" activation flow).
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: input.email,
      options: { redirectTo: `${env.APP_URL}/auth/set-password` },
    });

    if (!linkError && link?.properties?.action_link) {
      await sendEmail({
        to: input.email,
        subject: 'Your Calendar & Scheduling account has been created',
        html: accountCreatedEmail({
          recipientName: input.full_name,
          appUrl: env.APP_URL,
          activationUrl: link.properties.action_link,
        }),
      });
    }

    await recordAuditLog({ adminId: req.user!.id, action: 'CREATED_USER', targetUserId: created.user.id, metadata: { role: input.role, email: input.email } });

    res.status(201).json({ userId: created.user.id });
  })
);

const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  mobile: z.string().optional(),
  company: z.string().optional(),
  avatar_url: z.string().optional(),
  timezone: z.string().optional(),
});

adminRouter.patch(
  '/admin/users/:id',
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('profiles').update(input).eq('id', req.params.id).select().single();
    if (error) throw error;
    await recordAuditLog({ adminId: req.user!.id, action: 'EDITED_USER', targetUserId: req.params.id, metadata: input });
    res.json({ profile: data });
  })
);

adminRouter.patch(
  '/admin/users/:id/role',
  asyncHandler(async (req, res) => {
    const role = z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT']).parse(req.body?.role);
    const { data, error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await recordAuditLog({ adminId: req.user!.id, action: 'CHANGED_ROLE', targetUserId: req.params.id, metadata: { role } });
    res.json({ profile: data });
  })
);

adminRouter.delete(
  '/admin/users/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw new ApiHttpError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account');
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw new ApiHttpError(400, 'DELETE_FAILED', error.message);
    await recordAuditLog({ adminId: req.user!.id, action: 'DELETED_USER', targetUserId: req.params.id });
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// License / trial actions (one-click)
// ---------------------------------------------------------------------------
adminRouter.post(
  '/admin/users/:id/activate',
  asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin.rpc('admin_set_license_status', {
      p_target_user_id: req.params.id,
      p_status: 'ACTIVE',
      p_admin_id: req.user!.id,
      p_extend_days: null,
    });
    if (error) throw error;

    const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', req.params.id).single();
    await queueMultiChannel({
      userId: req.params.id,
      type: 'ACCOUNT_ACTIVATED',
      title: 'Your account is now fully active',
      body: 'An administrator has activated your full account.',
      dedupeKeyBase: `account-activated:${req.params.id}:${Date.now()}`,
    });

    res.json({ status: 'ACTIVE', name: profile?.full_name });
  })
);

adminRouter.post(
  '/admin/users/:id/lock',
  asyncHandler(async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

    await supabaseAdmin
      .from('profiles')
      .update({ status: 'LOCKED', locked_at: new Date().toISOString(), locked_by: req.user!.id, locked_reason: reason })
      .eq('id', req.params.id);

    await supabaseAdmin.rpc('admin_set_license_status', {
      p_target_user_id: req.params.id,
      p_status: 'LOCKED',
      p_admin_id: req.user!.id,
      p_extend_days: null,
    });

    await recordAuditLog({ adminId: req.user!.id, action: 'LOCKED_USER', targetUserId: req.params.id, metadata: { reason } });

    await queueMultiChannel({
      userId: req.params.id,
      type: 'ACCOUNT_LOCKED',
      title: 'Your account has been locked',
      body: reason ?? 'An administrator has locked your account.',
      dedupeKeyBase: `account-locked:${req.params.id}:${Date.now()}`,
    });

    res.json({ status: 'LOCKED' });
  })
);

adminRouter.post(
  '/admin/users/:id/unlock',
  asyncHandler(async (req, res) => {
    const { data: access } = await supabaseAdmin.from('user_access').select('*').eq('user_id', req.params.id).single();

    const now = new Date();
    const restoredStatus = access?.activated_at
      ? 'ACTIVE'
      : access?.trial_ends_at && new Date(access.trial_ends_at) < now
        ? 'EXPIRED'
        : 'TRIAL';

    await supabaseAdmin.from('profiles').update({ status: 'ACTIVE', locked_at: null, locked_by: null, locked_reason: null }).eq('id', req.params.id);
    await supabaseAdmin.rpc('admin_set_license_status', { p_target_user_id: req.params.id, p_status: restoredStatus, p_admin_id: req.user!.id, p_extend_days: null });

    await recordAuditLog({ adminId: req.user!.id, action: 'UNLOCKED_USER', targetUserId: req.params.id });

    await queueMultiChannel({
      userId: req.params.id,
      type: 'ACCOUNT_UNLOCKED',
      title: 'Your account has been unlocked',
      body: 'You may now sign in again.',
      dedupeKeyBase: `account-unlocked:${req.params.id}:${Date.now()}`,
    });

    res.json({ status: restoredStatus });
  })
);

adminRouter.post(
  '/admin/users/:id/suspend',
  asyncHandler(async (req, res) => {
    await supabaseAdmin.from('profiles').update({ status: 'SUSPENDED', suspended_at: new Date().toISOString() }).eq('id', req.params.id);
    await recordAuditLog({ adminId: req.user!.id, action: 'SUSPENDED_USER', targetUserId: req.params.id });
    res.json({ status: 'SUSPENDED' });
  })
);

adminRouter.post(
  '/admin/users/:id/extend-trial',
  asyncHandler(async (req, res) => {
    const days = z.coerce.number().int().positive().max(365).parse(req.body?.days ?? 15);
    const { error } = await supabaseAdmin.rpc('admin_set_license_status', {
      p_target_user_id: req.params.id,
      p_status: 'TRIAL',
      p_admin_id: req.user!.id,
      p_extend_days: days,
    });
    if (error) throw error;
    await recordAuditLog({ adminId: req.user!.id, action: 'EXTENDED_TRIAL', targetUserId: req.params.id, metadata: { days } });
    res.json({ extendedDays: days });
  })
);

adminRouter.post(
  '/admin/users/:id/reset-trial',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 15 * 24 * 60 * 60_000);
    const { error } = await supabaseAdmin
      .from('user_access')
      .update({ license_status: 'TRIAL', trial_started_at: now.toISOString(), trial_ends_at: trialEnds.toISOString(), activated_at: null, activated_by: null })
      .eq('user_id', req.params.id);
    if (error) throw error;
    await recordAuditLog({ adminId: req.user!.id, action: 'RESET_TRIAL', targetUserId: req.params.id });
    res.json({ trial_started_at: now.toISOString(), trial_ends_at: trialEnds.toISOString() });
  })
);

adminRouter.patch(
  '/admin/users/:id/expiry',
  asyncHandler(async (req, res) => {
    const trialEndsAt = z.string().datetime().parse(req.body?.trial_ends_at);
    const { error } = await supabaseAdmin.from('user_access').update({ trial_ends_at: trialEndsAt }).eq('user_id', req.params.id);
    if (error) throw error;
    await recordAuditLog({ adminId: req.user!.id, action: 'CHANGED_EXPIRY', targetUserId: req.params.id, metadata: { trial_ends_at: trialEndsAt } });
    res.json({ trial_ends_at: trialEndsAt });
  })
);

adminRouter.post(
  '/admin/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', req.params.id).single();
    if (!profile) throw new ApiHttpError(404, 'NOT_FOUND', 'User not found');

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo: `${env.APP_URL}/auth/set-password` },
    });
    if (error || !link?.properties?.action_link) throw new ApiHttpError(400, 'RESET_LINK_FAILED', error?.message ?? 'Could not generate reset link');

    await sendEmail({
      to: profile.email,
      subject: 'Reset your Calendar & Scheduling password',
      html: accountCreatedEmail({ recipientName: profile.full_name, appUrl: env.APP_URL, activationUrl: link.properties.action_link }),
    });

    await recordAuditLog({ adminId: req.user!.id, action: 'RESET_PASSWORD', targetUserId: req.params.id });
    res.json({ sent: true });
  })
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
adminRouter.get(
  '/admin/audit-logs',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabaseAdmin
      .from('audit_logs')
      .select('*, admin:admin_id(full_name, email), target:target_user_id(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    res.json({ data, total: count ?? 0, page, pageSize });
  })
);
