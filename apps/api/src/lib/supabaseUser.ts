import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Creates a Supabase client scoped to a single incoming request, forwarding
 * the end user's own access token. Every query made with this client is
 * subject to Row Level Security as that specific user — this is the
 * primary authorization boundary for all normal (non-admin) data access.
 */
export function createUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
