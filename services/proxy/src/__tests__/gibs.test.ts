import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// We'll inject a mock via global.__TEST_FETCH__ consumed by the route
const getFetch = () => (global as any).__TEST_FETCH__ as ReturnType<typeof vi.fn>;

describe('gibs geocolor proxy route', () => {
  beforeEach(() => {
    (global as any).__TEST_FETCH__ = vi.fn();
  });
  afterEach(() => {
    delete (global as any).__TEST_FETCH__;
  });

  it('serves a GeoColor tile (valid request) with correct headers + upstream URL', async () => {
    const mockBuf = Uint8Array.from([137, 80, 78, 71]); // PNG signature start
    const time = '2023-01-01T00:00:00Z';
  getFetch().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", 'image/png']]),
      arrayBuffer: async () => mockBuf.buffer
    });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get(`/api/gibs/geocolor/1/0/0.png?time=${encodeURIComponent(time)}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(r.headers['cache-control']).toContain('max-age=300');
    // Upstream URL assertions
    expect(getFetch()).toHaveBeenCalledTimes(1);
    const calledUrl: string = getFetch().mock.calls[0][0];
    expect(calledUrl.startsWith('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/')).toBe(true);
    // Time segment encoded
    expect(calledUrl).toContain(encodeURIComponent(time));
    // Coordinate ordering: path pattern .../<z>/<y>/<x>.ext ; request used z=1,x=0,y=0
    expect(calledUrl).toMatch(/\/1\/0\/0\.png$/);
  });

  it('handles upstream error status pass-through', async () => {
  getFetch().mockResolvedValue({ ok: false, status: 404, headers: new Map(), arrayBuffer: async () => new ArrayBuffer(0) });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/geocolor/2/1/1.jpg?time=current');
    expect(r.status).toBe(404);
    expect(getFetch()).toHaveBeenCalled();
  });

  it('rejects invalid numeric coords', async () => {
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/geocolor/x/y/z.png');
    expect(r.status).toBe(400);
  });

  it('builds upstream URL with y/x ordering distinct from input x/y', async () => {
    // Use distinctive numbers to verify ordering
  getFetch().mockResolvedValue({ ok: true, status: 200, headers: new Map([["content-type", 'image/jpeg']]), arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer });
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/gibs/geocolor/5/7/9.jpg?time=current');
    expect(r.status).toBe(200);
    const calledUrl: string = getFetch().mock.calls[0][0];
    // Expect .../5/9/7.jpg at end (z=5, y=9, x=7)
    expect(calledUrl).toMatch(/\/5\/9\/7\.jpg$/);
  });
});
