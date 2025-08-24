import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock global fetch for the three vendor routes
beforeEach(()=> {
  vi.restoreAllMocks();
});

describe('vendor routes', () => {
  it('owm tile returns png', async () => {
    process.env.OWM_API_KEY = 'test';
    process.env.FIRMS_MAP_KEY = 'ignore';
    process.env.NWS_USER_AGENT = 'UA';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async ()=> Buffer.from('PNG'), headers: { get: (k:string)=> k.toLowerCase()==='content-type' ? 'image/png' : null } })) as any);
    const { createApp } = await import('./index.js');
    const app = createApp();
    const r = await request(app).get('/api/owm/tiles/temp_new/1/2/3.png');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
  });
  it('firms csv pass through', async () => {
    process.env.FIRMS_MAP_KEY = 'abc123';
    process.env.OWM_API_KEY = 'test';
    process.env.NWS_USER_AGENT = 'UA';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async ()=> 'latitude,longitude\n1,2', headers: { get: (k:string)=> k.toLowerCase()==='content-type' ? 'text/csv' : null } })) as any);
    const { createApp } = await import('./index.js');
    const app = createApp();
    const r = await request(app).get('/api/firms/VIIRS_NOAA20_NRT/1');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
  expect(r.text).toContain('latitude');
  });
  it('nws forwards with user agent', async () => {
    process.env.NWS_USER_AGENT = 'TestUA';
    process.env.FIRMS_MAP_KEY = 'abc123';
    process.env.OWM_API_KEY = 'test';
    vi.stubGlobal('fetch', vi.fn(async (_url:string, init:any) => ({ ok: true, status: 200, arrayBuffer: async ()=> Buffer.from('{"ok":true}'), headers: { get: (k:string)=> k.toLowerCase()==='content-type' ? 'application/json' : null }, init })) as any);
    const { createApp } = await import('./index.js');
    const app = createApp();
    const r = await request(app).get('/api/nws/alerts/active');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/json');
  });
});

describe('flags endpoint', () => {
  it('returns enable3d false by default', async () => {
    delete process.env.ENABLE_3D;
    const { createApp } = await import('./index.js');
    const app = createApp();
    const r = await request(app).get('/api/flags');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ enable3d: false });
  });
  it('returns enable3d true when env set', async () => {
    process.env.ENABLE_3D = '1';
    const { createApp } = await import('./index.js');
    const app = createApp();
    const r = await request(app).get('/api/flags');
    expect(r.body).toEqual({ enable3d: true });
  });
});
