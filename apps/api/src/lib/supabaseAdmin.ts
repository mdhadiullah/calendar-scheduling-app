import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Privileged Supabase client using the service_role key. This BYPASSES
 * Row Level Security, so it must only ever be used inside trusted,
 * server-side code paths (admin actions, notification processing,
 * account provisioning) — never expose this key or this client to any
 * frontend (web/desktop/mobile).
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
