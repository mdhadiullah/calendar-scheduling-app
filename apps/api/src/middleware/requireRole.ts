import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@calendar-app/shared';
import { ApiHttpError } from './errorHandler';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new ApiHttpError(401, 'UNAUTHENTICATED', 'Not signed in'));
    if (!roles.includes(user.profile.role)) {
      return next(new ApiHttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
