import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUnifiedApiKey, getFreeOnlyApiKey } from '../db/index.js';
import { timingSafeStringEqual, extractApiToken } from './proxy.js';
import { getDb } from '../db/index.js';
import { decrypt } from '../lib/crypto.js';

export const imagesRouter = Router();

const generateSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1).max(80).optional(),
  n: z.number().int().min(1).max(10).optional().default(1),
  size: z.enum(['256x256', '512x512', '1024x1024']).optional().default('1024x1024'),
  response_format: z.enum(['url', 'b64_json']).optional().default('url'),
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

imagesRouter.post('/generations', async (req: Request, res: Response) => {
  const token = extractApiToken(req);
  const unifiedKey = getUnifiedApiKey();
  const freeOnlyKey = getFreeOnlyApiKey();
  if (!token || (!timingSafeStringEqual(token, unifiedKey) && !timingSafeStringEqual(token, freeOnlyKey))) {
    res.status(401).json({ error: { message: 'Invalid API key', type: 'authentication_error' } });
    return;
  }

  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', '), type: 'invalid_request_error' } });
    return;
  }

  const { prompt, model, size, response_format, n } = parsed.data;

  if (n > 1) {
    res.status(400).json({ error: { message: 'Multiple images (n > 1) is not supported', type: 'invalid_request_error' } });
    return;
  }

  const [width, height] = size.split('x');

  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  if (model) url.searchParams.set('model', model);
  url.searchParams.set('width', width);
  url.searchParams.set('height', height);
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('enhance', 'true');

  const key = getPollinationsKey();
  if (key && key !== 'no-key') {
    url.searchParams.set('key', key);
  }

  if (response_format === 'url') {
    // Generate the image URL without waiting for it to be rendered
    // Client will fetch the URL to get the image
    const fullUrl = url.toString();
    res.json({
      created: Math.floor(Date.now() / 1000),
      data: [
        {
          url: fullUrl
        }
      ]
    });
    return;
  }

  // Handle b64_json
  const headers: Record<string, string> = {};
  if (key && key !== 'no-key') {
    headers.Authorization = `Bearer ${key}`;
  }

  const upstream = await fetch(url, { headers });

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

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.json({
    created: Math.floor(Date.now() / 1000),
    data: [
      {
        b64_json: buffer.toString('base64')
      }
    ]
  });
});
