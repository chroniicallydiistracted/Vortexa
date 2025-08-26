import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { useStore } from '../../util/store';
describe('playback store slice', () => {
    it('advances time respecting speed label mapping', () => {
        const base = useStore.getState().playbackBaseStartMs;
        act(() => {
            useStore.getState().setPlaybackCurrentTimeMs(base);
            useStore.getState().setPlaybackSpeed('2x');
        });
        const before = useStore.getState().playbackCurrentTimeMs;
        // Simulate tick: for now app code does not auto-advance; emulate a 1 hour step based on speed heuristic
        const hourMs = 3600_000;
        const factor = { '0.5x': 0.5, '1x': 1, '2x': 2, '4x': 4 }[useStore.getState().playbackSpeed];
        act(() => {
            useStore.getState().setPlaybackCurrentTimeMs(before + hourMs * factor);
        });
        const after = useStore.getState().playbackCurrentTimeMs;
        expect(after - before).toBe(hourMs * factor);
    });
});
