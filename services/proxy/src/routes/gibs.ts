import { Router } from 'express';
import { fetch } from 'undici';

export const gibsRouter = Router();

async function fetchCapabilities(fetchImpl: typeof fetch, layerName: string) {
  const capsUrl = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';
  const r = await fetchImpl(capsUrl);
  if(!r.ok) throw new Error('upstream capabilities fetch failed');
  const xml = await r.text();
  // Build layered regex to isolate target <Layer> ... </Layer> containing Title
  const escaped = layerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const layerRegex = new RegExp(`<Layer>[\\s\\S]*?<(?:\\w+:)?Title>\\s*${escaped}\\s*<\\/(?:\\w+:)?Title>[\\s\\S]*?<\\/Layer>`, 'i');
  const layerBlockMatch = xml.match(layerRegex);
  if(!layerBlockMatch) return { times: [] as string[] };
  const layerBlock = layerBlockMatch[0];
  const dimMatch = layerBlock.match(/<Dimension[^>]*name="time"[^>]*>([\s\S]*?)<\/Dimension>/i);
  let times: string[] = [];
  if(dimMatch){
    times = dimMatch[1].split(/[,\s]+/).map(s=> s.trim()).filter(Boolean).filter(s=> /^(\d{4}-\d{2}-\d{2}T\d{2}:?\d{2}:?\d{2}Z)$/.test(s));
    times.sort();
  }
  return { times };
}

// Example endpoint: /api/gibs/geocolor/:z/:x/:y.png?time=2025-08-23T15:00:00Z
// Maps to GOES-East ABI GeoColor WMTS (GoogleMapsCompatible)
gibsRouter.get('/geocolor/:z/:x/:y.:ext', async (req, res) => {
  try {
    const { z, x, y, ext } = req.params as any;
    const time = (req.query.time as string) || 'current';
    const zN = Number(z), xN = Number(x), yN = Number(y);
    if(!Number.isFinite(zN) || !Number.isFinite(xN) || !Number.isFinite(yN)) return res.status(400).json({ error: 'invalid tile coordinates' });
    const extension = (ext || 'jpg').toLowerCase();
    // Upstream GOES-East GeoColor path pattern (epsg3857 best)
    const upstream = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/${encodeURIComponent(time)}/GoogleMapsCompatible/${zN}/${yN}/${xN}.${extension}`;
  // Allow test injection of fetch without altering production path (see gibs.test.ts)
  const injected = (global as any).__TEST_FETCH__;
  const doFetch: typeof fetch = injected || fetch;
  const r = await doFetch(upstream);
    if(!r.ok) return res.status(r.status).end();
    const buf = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', r.headers.get('content-type') || (extension==='png'?'image/png':'image/jpeg'));
    // Shorter cache (5 min) because of time dimension; can tune later
    res.set('Cache-Control','public, max-age=300');
    res.send(buf);
  } catch (e:any) {
    res.status(502).json({ error:'gibs fetch failed', detail: e.message });
  }
});

// Return available timestamps for GOES-East GeoColor layer
// Parses WMTS GetCapabilities and extracts Dimension name="time" values for the layer GOES-East_ABI_GeoColor
gibsRouter.get('/timestamps', async (req, res) => {
  try {
    const layer = (req.query.layer as string) || 'GOES-East_ABI_GeoColor';
    const injected = (global as any).__TEST_FETCH__;
    const doFetch: typeof fetch = injected || fetch;
  const { times } = await fetchCapabilities(doFetch, layer);
    res.set('Cache-Control','public, max-age=300');
    res.json(times);
  } catch (e:any) {
  res.status(/upstream capabilities/.test(e.message)? 502:500).json({ error:'failed to parse capabilities', detail: e.message });
  }
});

// Export utility for tests
export const __gibsUtils = { fetchCapabilities };
