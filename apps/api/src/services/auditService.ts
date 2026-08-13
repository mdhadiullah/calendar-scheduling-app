import { supabaseAdmin } from '../lib/supabaseAdmin';

export async function recordAuditLog(params: {
  adminId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: params.adminId,
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    metadata: params.metadata ?? {},
  });
}
