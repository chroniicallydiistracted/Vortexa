import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// NWS proxy tests

describe('nws proxy alerts rewrite', () => {
  beforeEach(() => {
    process.env.NWS_USER_AGENT = 'test-agent';
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/geo+json']]),
      text: async () => '{}',
    });
  });
  afterEach(() => {
    delete (global as any).fetch;
    delete process.env.NWS_USER_AGENT;
    vi.restoreAllMocks();
  });

  it('rewrites /alerts to /alerts/active with required headers', async () => {
    const { createApp } = await import('../index.js');
    const app = createApp();
    const res = await request(app).get('/api/nws/alerts?point=31.7619,-106.4850');
    expect(res.status).toBe(200);
    const f = (global as any).fetch as ReturnType<typeof vi.fn>;
    expect(f).toHaveBeenCalledWith(
      'https://api.weather.gov/alerts/active?point=31.7619,-106.4850',
      {
        headers: {
          'User-Agent': 'test-agent',
          Accept: 'application/geo+json',
        },
      },
    );
  });
});
