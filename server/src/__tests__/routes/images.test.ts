import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { getUnifiedApiKey, initDb } from '../../db/index.js';

vi.mock('../../services/router.js');
vi.mock('../../services/ratelimit.js');

describe('POST /v1/images/generations', () => {
  let app: ReturnType<typeof createApp>;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    initDb(':memory:');
    app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as import('node:net').AddressInfo;
    baseUrl = `http://${address.address}:${address.port}`;
  });

  afterEach(() => {
    if (server) {
      server.closeAllConnections();
      server.close();
    }
  });

  it('rejects without an API key', async () => {
    const res = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A cute cat' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.message).toBe('Invalid API key');
  });

  it('accepts valid API key and returns a URL response format', async () => {
    const unifiedKey = getUnifiedApiKey();
    const res = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unifiedKey}`,
      },
      body: JSON.stringify({ prompt: 'A cute cat' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].url).toContain('https://image.pollinations.ai/prompt/A%20cute%20cat');
    expect(body.data[0].url).toContain('width=1024&height=1024&nologo=true&enhance=true');
  });
});
