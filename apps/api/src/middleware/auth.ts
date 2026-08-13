import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, UserAccess } from '@calendar-app/shared';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { createUserScopedClient } from '../lib/supabaseUser';
import { ApiHttpError } from './errorHandler';

export interface AuthenticatedUser {
  id: string;
  email: string;
  accessToken: string;
  profile: Profile;
  access: UserAccess | null;
  supabase: SupabaseClient;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Validates the caller's Supabase access token, loads their profile and
 * license state, and rejects locked/suspended accounts.
 *
 * This is the single point where "Authentication", "User status", and
 * "Account lock status" (spec section 9, items 1-3) are enforced for
 * every protected route. License status (item 4) is enforced separately
 * by requirePermitted so that a handful of routes (e.g. /me, /billing)
 * remain reachable even when a trial has expired.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiHttpError(401, 'UNAUTHENTICATED', 'Missing or invalid Authorization header');
    }
    const accessToken = header.slice('Bearer '.length);

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      throw new ApiHttpError(401, 'UNAUTHENTICATED', 'Invalid or expired session');
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiHttpError(401, 'PROFILE_NOT_FOUND', 'No profile found for this account');
    }

    if (profile.status === 'LOCKED') {
      throw new ApiHttpError(403, 'ACCOUNT_LOCKED', 'Your account has been locked by an administrator');
    }
    if (profile.status === 'SUSPENDED') {
      throw new ApiHttpError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended');
    }

    const { data: access } = await supabaseAdmin
      .from('user_access')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    req.user = {
      id: userData.user.id,
      email: userData.user.email ?? profile.email,
      accessToken,
      profile: profile as Profile,
      access: (access as UserAccess) ?? null,
      supabase: createUserScopedClient(accessToken),
    };

    next();
  } catch (err) {
    next(err);
  }
}
