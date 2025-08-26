import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../util/store';
describe('layer selection logic', () => {
    beforeEach(() => {
        useStore.getState().replaceLayers([]);
    });
    it('adds a layer once and toggles opacity change', () => {
        const l = { id: 'radar', templateRaw: 'x' };
        useStore.getState().addLayer(l);
        useStore.getState().addLayer(l); // duplicate ignored
        expect(useStore.getState().layers.length).toBe(1);
        useStore.getState().setOpacity('radar', 0.5);
        expect(useStore.getState().layers[0].opacity).toBe(0.5);
    });
    it('removes a layer', () => {
        useStore.getState().addLayer({ id: 'a', templateRaw: 'x' });
        useStore.getState().removeLayer('a');
        expect(useStore.getState().layers.length).toBe(0);
    });
});
