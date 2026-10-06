import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../../app.js';
import { getUnifiedApiKey, initDb } from '../../db/index.js';

vi.mock('../../services/router.js');
vi.mock('../../services/ratelimit.js');

describe('POST /v1/images/generations', () => {
  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let url: string;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();
    server = http.createServer(app);
    server.listen(0);
    const { port } = server.address() as AddressInfo;
    url = `http://localhost:${port}`;
  });

  afterEach(() => {
    server.closeAllConnections();
    server.close();
  });

  it('rejects without an API key', async () => {
    const res = await fetch(`${url}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A cute cat' })
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API key');
  });

  it('accepts valid API key and returns a URL response format', async () => {
    const unifiedKey = getUnifiedApiKey();
    const res = await fetch(`${url}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unifiedKey}`
      },
      body: JSON.stringify({ prompt: 'A cute cat' })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].url).toContain('https://image.pollinations.ai/prompt/A%20cute%20cat');
    expect(body.data[0].url).toContain('width=1024&height=1024&nologo=true&enhance=true');
  });
});
