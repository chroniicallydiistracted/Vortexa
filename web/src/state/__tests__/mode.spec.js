import { describe, it, expect } from 'vitest';
import { useStore } from '../state-store';
// Mode persistence is handled in App via URL params; here we only verify store mechanics.
describe('mode persistence/store', () => {
    it('switches modes', () => {
        useStore.getState().setMode('2d');
        expect(useStore.getState().mode).toBe('2d');
        useStore.getState().setMode('3d');
        expect(useStore.getState().mode).toBe('3d');
    });
});
