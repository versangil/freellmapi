import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getUnifiedApiKey, initDb } from '../../db/index.js';

vi.mock('../../services/router.js');
vi.mock('../../services/ratelimit.js');

describe('POST /v1/images/generations', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();
  });

  it('rejects without an API key', async () => {
    const res = await request(app)
      .post('/v1/images/generations')
      .send({ prompt: 'A cute cat' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid API key');
  });

  it('accepts valid API key and returns a URL response format', async () => {
    const unifiedKey = getUnifiedApiKey();
    const res = await request(app)
      .post('/v1/images/generations')
      .set('Authorization', `Bearer ${unifiedKey}`)
      .send({ prompt: 'A cute cat' });

    expect(res.status).toBe(200);
    expect(res.body.data[0].url).toContain('https://image.pollinations.ai/prompt/A%20cute%20cat');
    expect(res.body.data[0].url).toContain('width=1024&height=1024&nologo=true&enhance=true');
  });
});
