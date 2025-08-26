import { useStore } from './store';

export async function fetchTimestamps(layerId: string): Promise<string[]> {
  try {
    const r = await fetch(`/api/gibs/timestamps?layer=${encodeURIComponent(layerId)}`);
    if (!r.ok) return [];
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return [];
    const json = await r.json();
    return json.timestamps || [];
  } catch (e) {
    console.debug('fetchTimestamps failed', { layerId, error: (e as Error).message });
    return [];
  }
}

export function buildTileUrl(
  baseTemplate: string,
  z: number,
  y: number,
  x: number,
  time?: string,
): string {
  // baseTemplate expected like /api/gibs/tile/Layer/{z}/{y}/{x}.ext
  let url = baseTemplate
    .replace('{z', '{z')
    .replace('{z}', String(z))
    .replace('{y}', String(y))
    .replace('{x}', String(x));
  if (time) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}time=${encodeURIComponent(time)}`;
  }
  return url;
}

// Hook to ensure timestamps loaded for selected layer (simple usage pattern)
export async function ensureGibsTimestamps(layerId: string) {
  const { gibsTimestamps, setGibsTimestamps } = useStore.getState();
  if (gibsTimestamps.length) return gibsTimestamps;
  const ts = await fetchTimestamps(layerId);
  setGibsTimestamps(ts);
  return ts;
}

// Prefetch next tile using HEAD (best-effort). Derive extension at call site.
export async function prefetchNextTile(
  layerId: string,
  z: number,
  y: number,
  x: number,
  nextIso?: string,
  ext?: 'png' | 'jpg' | 'jpeg',
) {
  const guessedExt = ext ?? (layerId.startsWith('GOES-') ? 'jpg' : 'png');
  const timeQuery = nextIso ? `?time=${encodeURIComponent(nextIso)}` : '';
  const url = `/api/gibs/tile/${encodeURIComponent(layerId)}/${z}/${y}/${x}.${guessedExt}${timeQuery}`;
  try {
    await fetch(url, { method: 'HEAD' });
  } catch {}
}
