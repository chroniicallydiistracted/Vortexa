import { describe, it, expect } from 'vitest';
import { buildTileUrl } from './gibs';

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
});