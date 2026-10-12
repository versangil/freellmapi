import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getUnifiedApiKey, initDb } from '../../db/index.js';

vi.mock('../../services/router.js');
vi.mock('../../services/ratelimit.js');

async function request(app: Express, method: string, path: string, body?: any, headers: Record<string, string> = {}) {
  const server = app.listen(0);
  const addr = server.address() as any;
  const url = `http://127.0.0.1:${addr.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.text();
  server.closeAllConnections();
  server.close();

  let json: any = null;
  try { json = JSON.parse(data); } catch {}

  return { status: res.status, body: json };
}

describe('POST /v1/images/generations', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();
  });

  it('rejects without an API key', async () => {
    const { status, body } = await request(app, 'POST', '/v1/images/generations', { prompt: 'A cute cat' });

    expect(status).toBe(401);
    expect(body.error.message).toBe('Invalid API key');
  });

  it('accepts valid API key and returns a URL response format', async () => {
    const unifiedKey = getUnifiedApiKey();
    const { status, body } = await request(app, 'POST', '/v1/images/generations', { prompt: 'A cute cat' }, { 'Authorization': `Bearer ${unifiedKey}` });

    expect(status).toBe(200);
    expect(body.data[0].url).toContain('https://image.pollinations.ai/prompt/A%20cute%20cat');
    expect(body.data[0].url).toContain('width=1024&height=1024&nologo=true&enhance=true');
  });
});
