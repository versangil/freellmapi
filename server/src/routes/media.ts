import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { decrypt } from '../lib/crypto.js';

export const mediaRouter = Router();

const generateSchema = z.object({
  type: z.enum(['image', 'video']),
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1).max(80).optional(),
});

function getPollinationsKey(): string | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT encrypted_key, iv, auth_tag
    FROM api_keys
    WHERE platform = 'pollinations' AND enabled = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as { encrypted_key: string; iv: string; auth_tag: string } | undefined;

  if (!row) return null;
  return decrypt(row.encrypted_key, row.iv, row.auth_tag);
}

function buildPollinationsUrl(type: 'image' | 'video', prompt: string, model?: string) {
  const url = new URL(`https://gen.pollinations.ai/${type}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('model', model ?? (type === 'image' ? 'flux' : 'seedance'));
  if (type === 'image') {
    url.searchParams.set('width', '1024');
    url.searchParams.set('height', '1024');
    url.searchParams.set('enhance', 'true');
  }
  return url;
}

mediaRouter.post('/generate', async (req: Request, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', ') } });
    return;
  }

  const key = getPollinationsKey();
  if (!key || key === 'no-key') {
    res.status(400).json({
      error: {
        message: 'Add an enabled Pollinations API key before generating images or videos.',
        type: 'missing_provider_key',
      },
    });
    return;
  }

  const { type, prompt, model } = parsed.data;
  const url = buildPollinationsUrl(type, prompt, model);
  url.searchParams.set('key', key);

  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  if (!upstream.ok) {
    const message = await upstream.text().catch(() => upstream.statusText);
    res.status(upstream.status).json({
      error: {
        message: message || `Pollinations returned HTTP ${upstream.status}`,
        type: 'provider_error',
      },
    });
    return;
  }

  const contentType = upstream.headers.get('content-type') ?? (type === 'image' ? 'image/jpeg' : 'video/mp4');
  const bytes = Buffer.from(await upstream.arrayBuffer());

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Media-Model', url.searchParams.get('model') ?? '');
  res.send(bytes);
});
