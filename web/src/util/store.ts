import { create } from 'zustand';
import { is3DEnabled } from '../lib/env';

function readRequestedModeFromLocation(): '2d' | '3d' {
  if (typeof window === 'undefined') return '2d';
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

function initialMode(): '2d' | '3d' {
  const requested = readRequestedModeFromLocation();
  const enabled = is3DEnabled();
  return requested === '3d' && enabled ? '3d' : '2d';
}

export type Layer = { id: string; templateRaw: string; opacity?: number };
export interface ViewState {
  lat: number;
  lon: number;
  zoom: number;
}

export type PlaybackSpeed = '0.5x' | '1x' | '2x' | '4x';
export interface TimeState {
  playbackBaseStartMs: number; // window start (ms UTC)
  playbackHoursSpan: number; // total hours represented by slider
  playbackCurrentTimeMs: number; // current time within window (ms UTC)
  playbackSpeed: PlaybackSpeed;
  setPlaybackCurrentTimeMs: (ms: number) => void;
  setPlaybackSpeed: (s: PlaybackSpeed) => void;
  setPlaybackBaseStart: (ms: number) => void;
  setPlaybackHoursSpan: (h: number) => void;
}

type Store = TimeState & {
  layers: Layer[];
  time: string; // ISO date (YYYY-MM-DD) for now
  playing: boolean;
  view: ViewState;
  mode: '2d' | '3d';
  gibsGeocolor3d: boolean;
  gibsTimestamps: string[]; // Available GIBS times (ISO)
  gibsSelectedTime: string | null;
  gibsPlaying: boolean;
  gibsPlaybackSpeedMs: number;
  gibsFps: number; // derived fps (clamped 2-8)
  gibsLoadError?: string | null;
  showFirms3d?: boolean;
  showOwmTemp3d?: boolean;
  addLayer: (l: Layer) => void;
  removeLayer: (id: string) => void;
  setTime: (iso: string) => void;
  stepTime: (deltaDays: number) => void;
  setOpacity: (id: string, opacity: number) => void;
  togglePlaying: () => void;
  setView: (v: Partial<ViewState>) => void;
  setMode: (m: '2d' | '3d') => void;
  toggleGibsGeocolor3d: () => void;
  setGibsTimestamps: (ts: string[]) => void;
  setGibsSelectedTime: (t: string | null) => void;
  toggleGibsPlaying: () => void;
  stepGibsTime: (direction: 1 | -1) => void;
  setGibsPlaybackSpeed: (ms: number) => void;
  toggleFirms3d: () => void;
  toggleOwmTemp3d: () => void;
  replaceLayers: (layers: Layer[]) => void;
  reset: () => void;
};

const today = new Date().toISOString().slice(0, 10);

export const useStore = create<Store>((set, get) => ({
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
  addLayer: (l) =>
    set((s) => ({
      layers: s.layers.find((x) => x.id === l.id) ? s.layers : [...s.layers, l],
    })),
  removeLayer: (id) => set((s) => ({ layers: s.layers.filter((x) => x.id !== id) })),
  setTime: (iso) => set({ time: iso }),
  stepTime: (delta) => {
    const cur = new Date(get().time + 'T00:00:00Z');
    cur.setDate(cur.getDate() + delta);
    set({ time: cur.toISOString().slice(0, 10) });
  },
  setOpacity: (id, opacity) =>
    set((s) => ({
      layers: s.layers.map((x) => (x.id === id ? { ...x, opacity } : x)),
    })),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  setPlaybackCurrentTimeMs: (ms: number) => set({ playbackCurrentTimeMs: ms }),
  setPlaybackSpeed: (s: PlaybackSpeed) => set({ playbackSpeed: s }),
  setPlaybackBaseStart: (ms: number) => set({ playbackBaseStartMs: ms }),
  setPlaybackHoursSpan: (h: number) => set({ playbackHoursSpan: h }),
  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
  setMode: (m) => set({ mode: m }),
  toggleGibsGeocolor3d: () => set((s) => ({ gibsGeocolor3d: !s.gibsGeocolor3d })),
  setGibsTimestamps: (ts) => set({ gibsTimestamps: ts }),
  setGibsSelectedTime: (t) => set({ gibsSelectedTime: t }),
  toggleGibsPlaying: () => set((s) => ({ gibsPlaying: !s.gibsPlaying })),
  stepGibsTime: (direction: 1 | -1) =>
    set((s) => {
      const { gibsTimestamps, gibsSelectedTime } = s;
      if (!gibsTimestamps.length) return {};
      const idx = gibsSelectedTime
        ? Math.max(0, gibsTimestamps.indexOf(gibsSelectedTime))
        : gibsTimestamps.length - 1;
      const next = (idx + direction + gibsTimestamps.length) % gibsTimestamps.length;
      return { gibsSelectedTime: gibsTimestamps[next] };
    }),
  setGibsPlaybackSpeed: (ms) => set({ gibsPlaybackSpeedMs: ms }),
  // FPS setter (clamp 2-8) and reflect in playback speed ms
  setGibsFps: (fps: number) =>
    set(() => {
      const clamped = Math.min(8, Math.max(2, Math.round(fps)));
      const ms = Math.round(1000 / clamped);
      return { gibsFps: clamped, gibsPlaybackSpeedMs: ms };
    }),
  setGibsLoadError: (err: string | null) => set({ gibsLoadError: err }),
  toggleFirms3d: () => set((s) => ({ showFirms3d: !s.showFirms3d })),
  toggleOwmTemp3d: () => set((s) => ({ showOwmTemp3d: !s.showOwmTemp3d })),
  replaceLayers: (layers) => set({ layers }),
  reset: () => set({ layers: [], time: today, playing: false }),
}));

// Layer presets (quick UX improvements)
export const LAYER_PRESETS: {
  key: string;
  name: string;
  layers: Omit<Layer, 'opacity'>[];
}[] = [
  {
    key: 'sat-geocolor',
    name: 'Satellite GeoColor',
    layers: [
      {
        id: 'gibs-geocolor',
        templateRaw:
          '{TILE_BASE}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=GOES-East_ABI_GeoColor&format=jpg&time={time}&z={z}&x={x}&y={y}',
      },
    ],
  },
  {
    key: 'radar-basic',
    name: 'Radar Composite',
    layers: [
      {
        id: 'ncep-mrms',
        templateRaw:
          '{TILE_BASE}/wmts?base=https%3A%2F%2Fopengeo.ncep.noaa.gov&layer=conus_radar&format=png&time={time}&z={z}&x={x}&y={y}',
      },
    ],
  },
];
