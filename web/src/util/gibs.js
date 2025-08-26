import { useStore } from './store';
export async function fetchTimestamps(layerId) {
    try {
        const r = await fetch(`/api/gibs/timestamps?layer=${encodeURIComponent(layerId)}`);
        if (!r.ok) {
            console.warn(`Failed to fetch timestamps for ${layerId}: ${r.status} ${r.statusText}`);
            return [];
        }
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            console.warn(`Invalid content type for timestamps: ${ct}`);
            return [];
        }
        const json = await r.json();
        const timestamps = json.timestamps || [];
        console.log(`Fetched ${timestamps.length} timestamps for ${layerId}`);
        return timestamps;
    }
    catch (e) {
        console.debug('fetchTimestamps failed', { layerId, error: e.message });
        return [];
    }
}
export function buildTileUrl(baseTemplate, z, y, x, time) {
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
export async function ensureGibsTimestamps(layerId) {
    const { gibsTimestamps, setGibsTimestamps } = useStore.getState();
    if (gibsTimestamps.length)
        return gibsTimestamps;
    const ts = await fetchTimestamps(layerId);
    setGibsTimestamps(ts);
    return ts;
}
// Prefetch next tile using HEAD (best-effort). Derive extension at call site.
export async function prefetchNextTile(layerId, z, y, x, nextIso, ext) {
    const guessedExt = ext ?? (layerId.startsWith('GOES-') ? 'jpg' : 'png');
    const timeQuery = nextIso ? `?time=${encodeURIComponent(nextIso)}` : '';
    const url = `/api/gibs/tile/${encodeURIComponent(layerId)}/${z}/${y}/${x}.${guessedExt}${timeQuery}`;
    try {
        await fetch(url, { method: 'HEAD' });
    }
    catch { }
}
