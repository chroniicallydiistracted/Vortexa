import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __internals } from '../lib/gibs/capabilities.js';
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
  beforeEach(()=> { 
    (global as any).__TEST_FETCH__ = vi.fn();
    __internals.capsCache.clear();
    __internals.tsCache.clear();
  });
  afterEach(()=> { delete (global as any).__TEST_FETCH__; });
  it('parses and returns sorted ISO timestamps array', async () => {
    (global as any).__TEST_FETCH__.mockResolvedValue({ ok: true, status:200, text: async () => sampleCaps });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/timestamps?layer=GOES-East_ABI_GeoColor');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toContain('max-age=60');
    expect(r.body.layer).toBe('GOES-East_ABI_GeoColor');
    expect(r.body.count).toBe(3);
    expect(r.body.timestamps).toEqual([
      '2025-08-22T15:00:00Z',
      '2025-08-22T16:00:00Z',
      '2025-08-22T17:00:00Z'
    ]);
    expect(r.body.latest).toBe('2025-08-22T17:00:00Z');
  });
  it('handles upstream failure gracefully', async () => {
    // Simulate capabilities fetch failure (non-ok status)
    (global as any).__TEST_FETCH__.mockResolvedValue({ ok:false, status:503, text: async () => '' });
    const { createApp } = await import('../index.js');
    const app = createApp();
  const r = await request(app).get('/api/gibs/timestamps?layer=GOES-East_ABI_GeoColor');
  expect(r.status).toBe(502);
  });
  it('returns empty array when layer missing', async () => {
  (global as any).__TEST_FETCH__.mockResolvedValue({ ok:true, status:200, text: async () => '<Capabilities></Capabilities>' });
    const { createApp } = await import('../index.js');
    const app = createApp();
  const r = await request(app).get('/api/gibs/timestamps?layer=Unknown_Layer');
  expect(r.status).toBe(200);
  expect(r.body.count).toBe(0);
  expect(r.body.timestamps).toEqual([]);
  });
});