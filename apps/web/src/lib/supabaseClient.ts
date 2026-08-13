import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check your .env file.');
}

// The web app talks to Supabase Auth directly for login/logout/password
// reset/session refresh (Supabase already implements these securely; the
// backend API adds the license/role/admin layer on top — see apps/api).
export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
