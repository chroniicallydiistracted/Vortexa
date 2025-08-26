import { describe, it, expect, vi } from 'vitest';
import { useStore } from './util-store';
import { prefetchNextTile } from './util-gibs';
describe('GIBS FPS clamp', () => {
    it('clamps below 2 to 2 and above 8 to 8', () => {
        const { setGibsFps } = useStore.getState();
        setGibsFps(1);
        expect(useStore.getState().gibsFps).toBe(2);
        setGibsFps(20);
        expect(useStore.getState().gibsFps).toBe(8);
    });
});
describe('prefetchNextTile', () => {
    it('invokes fetch with time param', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
        await prefetchNextTile('GOES-East_ABI_GeoColor', 2, 1, 0, '2025-08-24T19:00:00Z');
        const called = spy.mock.calls.find((c) => String(c[0]).includes('time=2025-08-24T19%3A00%3A00Z'));
        expect(called).toBeTruthy();
        spy.mockRestore();
    });
});
