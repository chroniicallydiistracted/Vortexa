import { describe, it, expect, vi } from 'vitest';
import { buildTileUrl, prefetchNextTile, fetchTimestamps } from './gibs';

describe('gibs buildTileUrl', () => {
  it('appends time when provided', () => {
    const base = '/api/gibs/tile/GOES-East_ABI_GeoColor/{z}/{y}/{x}.jpg';
    const url = buildTileUrl(base, 2, 1, 0, '2025-08-24T19:00:00Z');
    expect(url).toContain('time=2025-08-24T19%3A00%3A00Z');
  });
  it('omits time when not provided', () => {
    const base = '/api/gibs/tile/GOES-East_ABI_GeoColor/{z}/{y}/{x}.jpg';
    const url = buildTileUrl(base, 3, 5, 7);
    expect(url).not.toContain('time=');
  });
  it('prefetch uses HEAD and correct extension', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, headers: new Headers() } as any);
    await prefetchNextTile('LayerX', 3, 4, 5, '2025-08-24T00:00:00Z', 'jpg');
    const call = spy.mock.calls[0];
    expect(call[0]).toContain('/api/gibs/tile/LayerX/3/4/5.jpg?time=2025-08-24T00%3A00%3A00Z');
    expect(call[1]?.method).toBe('HEAD');
    spy.mockRestore();
  });
  it('fetchTimestamps returns [] on non-json content-type', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      json: async () => ({ timestamps: ['x'] }),
    } as any);
    const r = await fetchTimestamps('L');
    expect(r).toEqual([]);
    spy.mockRestore();
  });
});
