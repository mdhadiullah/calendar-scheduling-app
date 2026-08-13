import { ApiClient } from '@calendar-app/shared';
import { supabase } from './supabaseClient';

export const api = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
