import { Router } from 'express';
import type { Request, Response } from 'express';
import { getUnifiedApiKey, regenerateUnifiedKey, getFreeOnlyApiKey, regenerateFreeOnlyKey } from '../db/index.js';

export const settingsRouter = Router();

// Get the unified API key
settingsRouter.get('/api-key', (_req: Request, res: Response) => {
  res.json({ apiKey: getUnifiedApiKey() });
});

// Regenerate the unified API key
settingsRouter.post('/api-key/regenerate', (_req: Request, res: Response) => {
  const newKey = regenerateUnifiedKey();
  res.json({ apiKey: newKey });
});

// Get the free-only API key
settingsRouter.get('/free-api-key', (_req: Request, res: Response) => {
  res.json({ apiKey: getFreeOnlyApiKey() });
});

// Regenerate the free-only API key
settingsRouter.post('/free-api-key/regenerate', (_req: Request, res: Response) => {
  const newKey = regenerateFreeOnlyKey();
  res.json({ apiKey: newKey });
});
