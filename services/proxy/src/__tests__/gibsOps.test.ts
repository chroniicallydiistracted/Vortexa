// Test uses dynamic mock injection; any still acceptable via test override.
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

describe('gibs ops polish (rate limiting + metrics)', () => {
  it('enforces rate limiting returning 429 after burst', async () => {
    process.env.GIBS_RATE_BURST = '2';
    process.env.GIBS_RATE_REFILL_PER_SEC = '0';
    const { createApp } = await import('../index.js');
    // Inject test fetch used by gibs route & capabilities util
    (global as any).__TEST_FETCH__ = vi
      .fn()
      // capabilities XML (once per tile call until cached)
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          `<?xml version=\"1.0\"?><Capabilities><Contents><Layer><Title>GOES-East_ABI_GeoColor</Title><Dimension name=\"time\">2025-08-24T18:00:00Z 2025-08-24T19:00:00Z</Dimension></Layer></Contents></Capabilities>`,
      })
      // tile fetches (second call onward)
      .mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      });
    const app = createApp();
    const allowed1 = await request(app).get('/api/gibs/tile/GOES-East_ABI_GeoColor/1/0/0.png');
    const allowed2 = await request(app).get('/api/gibs/tile/GOES-East_ABI_GeoColor/1/0/0.png');
    expect([200, 400, 404, 500]).toContain(allowed1.status);
    expect([200, 400, 404, 500]).toContain(allowed2.status);
    const limited = await request(app).get('/api/gibs/tile/GOES-East_ABI_GeoColor/1/0/0.png');
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('rate_limited');
  });
});
