import { ApiClient } from '@calendar-app/shared';
import { supabase } from './supabaseClient';

export const api = new ApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL as string,
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
