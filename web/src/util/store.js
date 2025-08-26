import { create } from 'zustand';
import { is3DEnabled } from '../lib/env';
function readRequestedModeFromLocation() {
    if (typeof window === 'undefined')
        return '2d';
    const search = new URLSearchParams(window.location.search);
    const fromSearch = (search.get('mode') ?? '').toLowerCase();
    let fromHash = '';
    if (!fromSearch && window.location.hash) {
        const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        fromHash = (h.get('mode') ?? '').toLowerCase();
    }
    const requested = fromSearch || fromHash;
    return requested === '3d' ? '3d' : '2d';
}
function initialMode() {
    const requested = readRequestedModeFromLocation();
    const enabled = is3DEnabled();
    return requested === '3d' && enabled ? '3d' : '2d';
}
// Helper to get current mode from location (for runtime updates)
function getCurrentModeFromLocation() {
    const requested = readRequestedModeFromLocation();
    const enabled = is3DEnabled();
    return requested === '3d' && enabled ? '3d' : '2d';
}
const today = new Date().toISOString().slice(0, 10);
export const useStore = create((set, get) => ({
    layers: [],
    time: today,
    playing: false,
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
    view: { lat: 33.448, lon: -112.074, zoom: 6 },
    mode: initialMode(),
    gibsGeocolor3d: false,
    gibsTimestamps: [],
    gibsSelectedTime: null,
    gibsPlaying: false,
    gibsPlaybackSpeedMs: 1500,
    gibsFps: 4,
    gibsLoadError: null,
    showFirms3d: false,
    showOwmTemp3d: false,
    addLayer: (l) => set((s) => ({
        layers: s.layers.find((x) => x.id === l.id) ? s.layers : [...s.layers, l],
    })),
    removeLayer: (id) => set((s) => ({ layers: s.layers.filter((x) => x.id !== id) })),
    setTime: (iso) => set({ time: iso }),
    stepTime: (delta) => {
        const cur = new Date(get().time + 'T00:00:00Z');
        cur.setDate(cur.getDate() + delta);
        set({ time: cur.toISOString().slice(0, 10) });
    },
    setOpacity: (id, opacity) => set((s) => ({
        layers: s.layers.map((x) => (x.id === id ? { ...x, opacity } : x)),
    })),
    togglePlaying: () => set((s) => ({ playing: !s.playing })),
    setPlaybackCurrentTimeMs: (ms) => set({ playbackCurrentTimeMs: ms }),
    setPlaybackSpeed: (s) => set({ playbackSpeed: s }),
    setPlaybackBaseStart: (ms) => set({ playbackBaseStartMs: ms }),
    setPlaybackHoursSpan: (h) => set({ playbackHoursSpan: h }),
    setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
    setMode: (m) => set({ mode: m }),
    updateModeFromLocation: () => set({ mode: getCurrentModeFromLocation() }),
    toggleGibsGeocolor3d: () => set((s) => ({ gibsGeocolor3d: !s.gibsGeocolor3d })),
    setGibsTimestamps: (ts) => set({ gibsTimestamps: ts }),
    setGibsSelectedTime: (t) => set({ gibsSelectedTime: t }),
    toggleGibsPlaying: () => set((s) => ({ gibsPlaying: !s.gibsPlaying })),
    stepGibsTime: (direction) => set((s) => {
        const { gibsTimestamps, gibsSelectedTime } = s;
        if (!gibsTimestamps.length)
            return {};
        const idx = gibsSelectedTime
            ? Math.max(0, gibsTimestamps.indexOf(gibsSelectedTime))
            : gibsTimestamps.length - 1;
        const next = (idx + direction + gibsTimestamps.length) % gibsTimestamps.length;
        return { gibsSelectedTime: gibsTimestamps[next] };
    }),
    setGibsPlaybackSpeed: (ms) => set({ gibsPlaybackSpeedMs: ms }),
    // FPS setter (clamp 2-8) and reflect in playback speed ms
    setGibsFps: (fps) => set(() => {
        const clamped = Math.min(8, Math.max(2, Math.round(fps)));
        const ms = Math.round(1000 / clamped);
        return { gibsFps: clamped, gibsPlaybackSpeedMs: ms };
    }),
    setGibsLoadError: (err) => set({ gibsLoadError: err }),
    toggleFirms3d: () => set((s) => ({ showFirms3d: !s.showFirms3d })),
    toggleOwmTemp3d: () => set((s) => ({ showOwmTemp3d: !s.showOwmTemp3d })),
    replaceLayers: (layers) => set({ layers }),
    reset: () => set({ layers: [], time: today, playing: false }),
}));
// Layer presets (quick UX improvements)
export const LAYER_PRESETS = [
    {
        key: 'sat-geocolor',
        name: 'Satellite GeoColor',
        layers: [
            {
                id: 'gibs-geocolor',
                templateRaw: '{TILE_BASE}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=GOES-East_ABI_GeoColor&format=jpg&time={time}&z={z}&x={x}&y={y}',
            },
        ],
    },
    {
        key: 'radar-basic',
        name: 'Radar Composite',
        layers: [
            {
                id: 'ncep-mrms',
                templateRaw: '{TILE_BASE}/wmts?base=https%3A%2F%2Fopengeo.ncep.noaa.gov&layer=conus_radar&format=png&time={time}&z={z}&x={x}&y={y}',
            },
        ],
    },
];
