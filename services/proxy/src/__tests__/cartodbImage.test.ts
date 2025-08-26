// Test file: mock axios with relaxed types.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Minimal PNG (8-byte signature + IHDR length stub) just to validate binary path
const MOCK_TILE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);

describe('cartodb imagery binary serving', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('returns binary PNG bytes with correct headers', async () => {
    const axiosMod = await import('axios');
    (axiosMod as any).default.get = vi.fn(async () => ({ data: MOCK_TILE }));
    const { createApp } = await import('../index.js');
    const app = createApp();
    const r = await request(app).get('/api/cartodb/positron/3/2/1.png');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(r.body.length).toBeGreaterThan(8);
    // PNG signature
    expect(r.body[0]).toBe(137);
    expect(r.body[1]).toBe(80);
  });
});
