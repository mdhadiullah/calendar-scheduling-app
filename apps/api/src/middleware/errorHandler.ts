import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

export class ApiHttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiHttpError) {
    if (err.status >= 500) logger.error({ err }, 'Request failed');
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  // Never leak internal error details to the client.
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<void>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
