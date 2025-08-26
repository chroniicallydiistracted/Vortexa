// Utilities to serialize/deserialize app state into URL hash for permalinks & share links.
import { Layer } from './util-store';

export interface PermalinkState {
  t?: string; // date (YYYY-MM-DD)
  z?: number;
  lat?: number;
  lon?: number;
  l?: string; // layers compressed id[:opacity][,id[:opacity]...]
}

export function encodeLayers(layers: Layer[]): string | undefined {
  if (!layers.length) return undefined;
  return layers
    .map((l) => (l.opacity != null ? `${l.id}:${Number(l.opacity).toFixed(2)}` : l.id))
    .join(',');
}

export function decodeLayers(encoded?: string): { id: string; opacity?: number }[] {
  if (!encoded) return [];
  return encoded.split(',').map((tok) => {
    const [id, op] = tok.split(':');
    return { id, opacity: op ? Number(op) : undefined };
  });
}

export function buildHash(state: {
  time: string;
  view: { lat: number; lon: number; zoom: number };
  layers: Layer[];
}): string {
  const obj: PermalinkState = {
    t: state.time,
    z: Number(state.view.zoom.toFixed(2)),
    lat: Number(state.view.lat.toFixed(3)),
    lon: Number(state.view.lon.toFixed(3)),
  };
  const layerStr = encodeLayers(state.layers);
  if (layerStr) obj.l = layerStr;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    params.set(k, String(v));
  }
  return '#' + params.toString();
}

export function parseHash(hash: string): PermalinkState {
  if (hash.startsWith('#')) hash = hash.slice(1);
  const p = new URLSearchParams(hash);
  const st: PermalinkState = {};
  if (p.get('t')) st.t = p.get('t')!;
  if (p.get('z')) st.z = Number(p.get('z'));
  if (p.get('lat')) st.lat = Number(p.get('lat'));
  if (p.get('lon')) st.lon = Number(p.get('lon'));
  if (p.get('l')) st.l = p.get('l')!;
  return st;
}
