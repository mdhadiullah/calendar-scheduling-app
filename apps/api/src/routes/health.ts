import { Router } from 'express';

export const healthRouter = Router();

// GET /health — required by Hostnin / any uptime monitor. No auth, no DB
// dependency, so it stays fast and cheap even under load.
healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});
