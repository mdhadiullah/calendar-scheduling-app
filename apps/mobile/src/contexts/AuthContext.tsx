import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile, UserAccess } from '@calendar-app/shared';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/apiClient';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  access: UserAccess | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, access: null, loading: true });

  const loadProfile = useCallback(async () => {
    try {
      const me = await api.get<{ profile: Profile; access: UserAccess | null }>('/api/me');
      setState((s) => ({ ...s, profile: me.profile, access: me.access, loading: false }));
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState((s) => ({ ...s, session: data.session }));
      if (data.session) loadProfile();
      else setState((s) => ({ ...s, loading: false }));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session }));
      if (session) loadProfile();
      else setState((s) => ({ ...s, profile: null, access: null, loading: false }));
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return <AuthContext.Provider value={{ ...state, signIn, signOut, refresh: loadProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
