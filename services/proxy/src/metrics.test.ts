import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './index';

// Minimal test to ensure /metrics endpoint responds and includes expected counters.
describe('metrics endpoint', () => {
  const app = createApp();
  it('returns text/plain metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(/proxy_requests_total/);
    expect(res.text).toMatch(/proxy_cache_hit_ratio/);
  });
});
