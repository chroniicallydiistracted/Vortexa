// Legacy test superseded by gibsCapabilities.spec.ts; minimal redirect coverage.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

describe('gibs legacy geocolor redirect', () => {
  it('redirects to new generic route', async () => {
    const app = createApp({ allowHosts: ['gibs.earthdata.nasa.gov'] });
    const res = await request(app).get('/api/gibs/geocolor/1/2/3.png');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/api\/gibs\/tile\/GOES-East_ABI_GeoColor\/1\/3\/2\.png/);
  });
});
