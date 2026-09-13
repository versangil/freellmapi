import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getUnifiedApiKey, initDb } from '../../db/index.js';

vi.mock('../../services/router.js');
vi.mock('../../services/ratelimit.js');

async function testRequest(app: Express, body: any, headers: Record<string, string> = {}) {
  const server = app.listen(0);
  const addr = server.address() as any;
  const url = `http://127.0.0.1:${addr.port}/v1/images/generations`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  server.close();

  let json: any = null;
  try { json = JSON.parse(text); } catch {}

  return { status: res.status, body: json, headers: res.headers };
}

describe('POST /v1/images/generations', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();
  });

  it('rejects without an API key', async () => {
    const res = await testRequest(app, { prompt: 'A cute cat' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid API key');
  });

  it('accepts valid API key and returns a URL response format', async () => {
    const unifiedKey = getUnifiedApiKey();
    const res = await testRequest(app, { prompt: 'A cute cat' }, {
      'Authorization': `Bearer ${unifiedKey}`
    });

    expect(res.status).toBe(200);
    expect(res.body.data[0].url).toContain('https://image.pollinations.ai/prompt/A%20cute%20cat');
    expect(res.body.data[0].url).toContain('width=1024&height=1024&nologo=true&enhance=true');
  });
});
