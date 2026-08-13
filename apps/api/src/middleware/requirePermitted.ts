import type { NextFunction, Request, Response } from 'express';
import { isLicenseUsable } from '@calendar-app/shared';
import { ApiHttpError } from './errorHandler';

/**
 * Enforces license status (spec section 9, item 4) for routes that
 * represent "normal application access". Administrators always pass.
 * Locked/expired/cancelled users are rejected with a machine-readable
 * code so the frontend can show the trial-expired / locked screen.
 */
export function requirePermitted(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return next(new ApiHttpError(401, 'UNAUTHENTICATED', 'Not signed in'));

  if (user.profile.role === 'ADMIN') return next();

  const status = user.access?.license_status;
  if (!status || !isLicenseUsable(status)) {
    const code = status === 'LOCKED' ? 'LICENSE_LOCKED' : status === 'CANCELLED' ? 'LICENSE_CANCELLED' : 'LICENSE_EXPIRED';
    return next(new ApiHttpError(402, code, 'Your trial or license is no longer active. Contact your administrator.'));
  }

  next();
}
