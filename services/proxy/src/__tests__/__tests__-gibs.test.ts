import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __internals } from '../lib/gibs/capabilities.js';
import request from 'supertest';

// We'll inject a mock via global.__TEST_FETCH__ consumed by the route
const getFetch = () => (global as any).__TEST_FETCH__ as ReturnType<typeof vi.fn>;
// Test file – allows any for injected mocks via global.__TEST_FETCH__

describe('gibs geocolor proxy route', () => {
  beforeEach(() => {
    (global as any).__TEST_FETCH__ = vi.fn();
    // Clear caches between tests to ensure fetch call counts deterministic
    __internals.capsCache.clear();
    __internals.tsCache.clear();
    __internals.latestCache.clear();
  });
  afterEach(() => {
    delete (global as any).__TEST_FETCH__;
  });

  it('serves a GeoColor tile (valid request) with correct headers + upstream URL (via redirect)', async () => {
    const mockBuf = Uint8Array.from([137, 80, 78, 71]);
    const time = '2023-01-01T00:00:00Z';
  const capsXml = `<?xml version="1.0"?><Capabilities><Contents><Layer><Title>GOES-East_ABI_GeoColor</Title><Dimension name="time"><ows:Identifier>Time</ows:Identifier><Value>2022-12-31T23:00:00Z ${time}</Value></Dimension></Layer></Contents></Capabilities>`;
  getFetch()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => capsXml,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        arrayBuffer: async () => mockBuf.buffer,
      });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r0 = await request(app).get(
      `/api/gibs/geocolor/1/0/0.png?time=${encodeURIComponent(time)}`,
    );
    expect(r0.status).toBe(302);
    const r = await request(app).get(r0.headers.location!);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(r.headers['cache-control']).toContain('max-age=60');
    expect(getFetch()).toHaveBeenCalledTimes(2);
    const calledUrl: string = getFetch().mock.calls[1][0];
    expect(
      calledUrl.startsWith(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/',
      ),
    ).toBe(true);
    // geocolor redirect does not preserve querystring; proxy treats missing time as literal 'default'
    expect(calledUrl).toContain('/default/');
    expect(calledUrl).toMatch(/\/1\/0\/0\.png$/);
  });

  it('handles upstream error status pass-through (direct tile route)', async () => {
  const capsXml = `<?xml version="1.0"?><Capabilities><Contents><Layer><ows:Identifier>GOES-East_ABI_GeoColor</ows:Identifier><Title>GOES-East_ABI_GeoColor</Title><Dimension name="time"><ows:Identifier>Time</ows:Identifier><Value>2023-01-01T00:00:00Z</Value></Dimension></Layer></Contents></Capabilities>`;
    getFetch()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => capsXml,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map(),
        arrayBuffer: async () => new ArrayBuffer(0),
      });
    const { createApp } = await import('../index.js');
    const app = createApp();
  const r = await request(app).get('/api/gibs/tile/GOES-East_ABI_GeoColor/2/1/1.png');
    expect(r.status).toBe(404);
    expect(getFetch()).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid numeric coords (redirect then 400)', async () => {
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r0 = await request(app).get('/api/gibs/geocolor/x/y/z.png');
    expect(r0.status).toBe(302);
    const r = await request(app).get(r0.headers.location!);
    expect(r.status).toBe(400);
  });

  it('builds upstream URL with y/x ordering distinct from input x/y (direct tile route)', async () => {
  const capsXml = `<?xml version="1.0"?><Capabilities><Contents><Layer><ows:Identifier>GOES-East_ABI_GeoColor</ows:Identifier><Title>GOES-East_ABI_GeoColor</Title><Dimension name="time"><ows:Identifier>Time</ows:Identifier><Value>2023-01-01T00:00:00Z</Value></Dimension></Layer></Contents></Capabilities>`;
    getFetch()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => capsXml,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
      });
    const { createApp } = await import('../index.js');
    const app = createApp();
  const r = await request(app).get('/api/gibs/tile/GOES-East_ABI_GeoColor/5/9/7.png');
    expect(r.status).toBe(200);
    const calledUrl: string = getFetch().mock.calls[1][0];
  expect(calledUrl).toMatch(/\/5\/9\/7\.png$/);
  });

  it('serves explicit time via generic tile route', async () => {
  const capsXml = `<?xml version="1.0"?><Capabilities><Contents><Layer><ows:Identifier>GOES-East_ABI_GeoColor</ows:Identifier><Title>GOES-East_ABI_GeoColor</Title><Dimension name="time"><ows:Identifier>Time</ows:Identifier><Value>2023-01-01T00:00:00Z 2023-01-01T00:10:00Z</Value></Dimension></Layer></Contents></Capabilities>`;
    const time = '2023-01-01T00:10:00Z';
    getFetch()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => capsXml,
      }) // capabilities
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get(
      `/api/gibs/tile/GOES-East_ABI_GeoColor/3/2/1.png?time=${encodeURIComponent(time)}`,
    );
    expect(r.status).toBe(200);
    expect(getFetch()).toHaveBeenCalledTimes(2); // caps + tile
    const tileUrl: string = getFetch().mock.calls[1][0];
    expect(tileUrl).toContain(time);
  });

  it('rejects invalid explicit time', async () => {
    const capsXml = `<?xml version="1.0"?><Capabilities><Contents><Layer><Title>GOES-East_ABI_GeoColor</Title><Dimension name="time">2023-01-01T00:00:00Z</Dimension></Layer></Contents></Capabilities>`;
    getFetch().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => capsXml,
    });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const badTime = '2023-01-01T00:10:00Z';
    const r = await request(app).get(
      `/api/gibs/tile/GOES-East_ABI_GeoColor/1/0/0.png?time=${encodeURIComponent(badTime)}`,
    );
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid time for layer');
  });
});
