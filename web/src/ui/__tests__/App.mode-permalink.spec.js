import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
vi.mock('../../components/Map', () => ({ default: () => null }));
vi.mock('../../map/cesium/CesiumGlobe', () => ({ default: () => null }));
describe('App mode permalink + env gating', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.unstubAllEnvs();
        window.history.replaceState(null, '', '/');
        // Reset store state to ensure clean test environment
        const { useStore } = await import('../../state/state-store');
        useStore.setState({
            mode: '2d',
            layers: [],
            time: new Date().toISOString().slice(0, 10),
            playing: false,
            view: { lat: 33.448, lon: -112.074, zoom: 6 },
            gibsGeocolor3d: false,
            gibsTimestamps: [],
            gibsSelectedTime: null,
            gibsPlaying: false,
            gibsPlaybackSpeedMs: 1500,
            gibsFps: 4,
            gibsLoadError: null,
            showFirms3d: false,
            showOwmTemp3d: false,
            playbackBaseStartMs: (() => {
                const d = new Date();
                d.setMinutes(0, 0, 0);
                return d.getTime() - 24 * 3600_000;
            })(),
            playbackHoursSpan: 48,
            playbackCurrentTimeMs: (() => {
                const d = new Date();
                d.setMinutes(0, 0, 0);
                return d.getTime();
            })(),
            playbackSpeed: '1x',
        });
    });
    it('restores 3D mode from ?mode=3d when VITE_ENABLE_3D=1', async () => {
        process.env.VITE_ENABLE_3D = '1';
        vi.stubEnv('VITE_ENABLE_3D', '1');
        window.history.replaceState(null, '', '/?mode=3d');
        const { useStore } = await import('../../state/state-store');
        const { default: App } = await import('../App');
        renderWithMantine(_jsx(App, {}));
        expect(useStore.getState().mode).toBe('3d');
    });
    it('coerces to 2D when VITE_ENABLE_3D=0 even if ?mode=3d present', async () => {
        process.env.VITE_ENABLE_3D = '0';
        vi.stubEnv('VITE_ENABLE_3D', '0');
        window.history.replaceState(null, '', '/?mode=3d');
        const { useStore } = await import('../../state/state-store');
        const { default: App } = await import('../App');
        renderWithMantine(_jsx(App, {}));
        expect(useStore.getState().mode).toBe('2d');
    });
    it('accepts #mode=3d (hash fallback) when enabled', async () => {
        process.env.VITE_ENABLE_3D = '1';
        vi.stubEnv('VITE_ENABLE_3D', '1');
        window.history.replaceState(null, '', '/#mode=3d');
        const { useStore } = await import('../../state/state-store');
        const { default: App } = await import('../App');
        renderWithMantine(_jsx(App, {}));
        expect(useStore.getState().mode).toBe('3d');
    });
});
