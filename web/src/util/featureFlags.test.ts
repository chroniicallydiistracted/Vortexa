import { describe, it, expect, vi } from 'vitest';
import { getRuntimeFlags } from './featureFlags';

describe('feature flags client util', () => {
  it('falls back to false on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async ()=> { throw new Error('network'); }) as any);
    const f = await getRuntimeFlags();
    expect(f.enable3d).toBe(false);
  });
  it('parses enable3d true', async () => {
    vi.stubGlobal('fetch', vi.fn(async ()=> ({ ok:true, json: async ()=> ({ enable3d: true }) })) as any);
    const f = await getRuntimeFlags();
    expect(f.enable3d).toBe(true);
  });
});
