import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

const sampleCaps = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities>
  <Contents>
    <Layer>
      <ows:Title>GOES-East_ABI_GeoColor</ows:Title>
      <Dimension name="time">2025-08-22T15:00:00Z,2025-08-22T16:00:00Z 2025-08-22T17:00:00Z</Dimension>
    </Layer>
  </Contents>
</Capabilities>`;

describe('gibs timestamps endpoint', () => {
  beforeEach(()=> { (global as any).__TEST_FETCH__ = vi.fn(); });
  afterEach(()=> { delete (global as any).__TEST_FETCH__; });
  it('parses and returns sorted ISO timestamps array', async () => {
    (global as any).__TEST_FETCH__.mockResolvedValue({ ok: true, status:200, text: async () => sampleCaps });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/timestamps');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toContain('max-age=300');
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body).toEqual([
      '2025-08-22T15:00:00Z',
      '2025-08-22T16:00:00Z',
      '2025-08-22T17:00:00Z'
    ]);
  });
  it('handles upstream failure gracefully', async () => {
    (global as any).__TEST_FETCH__.mockResolvedValue({ ok:false, status:503, text: async () => '' });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/timestamps');
    expect(r.status).toBe(502);
  });
  it('returns empty array when layer missing', async () => {
    (global as any).__TEST_FETCH__.mockResolvedValue({ ok:true, status:200, text: async () => '<Capabilities></Capabilities>' });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/timestamps');
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
});