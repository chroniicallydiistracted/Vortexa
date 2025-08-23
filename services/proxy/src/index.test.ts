import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './index';

describe('proxy basic endpoints', () => {
  const app = createApp({ allowHosts: ['example.com'] });
  it('GET /health returns ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
  it('GET /healthz returns status ok', async () => {
    const r = await request(app).get('/healthz');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
    expect(Array.isArray(r.body.upstreams)).toBe(true);
  });
});
