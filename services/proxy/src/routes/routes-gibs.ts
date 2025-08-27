import { Router } from 'express';
import { shortLived60 } from '../middleware/cache.js';
import { fetch } from 'undici';
import {
  getTimestamps,
  getLatestTimestamp,
  buildTileUrl,
  pickTms,
} from '../lib/gibs/capabilities.js';

export const gibsRouter = Router();

// Health check endpoint to verify WMTS connectivity
gibsRouter.get('/health', shortLived60, async (req, res) => {
  try {
    const layer = (req.query.layer as string) || 'GOES-East_ABI_GeoColor';
    const timestamps = await getTimestamps(layer);
    const latest = await getLatestTimestamp(layer);

    res.json({
      status: 'healthy',
      layer,
      timestampCount: timestamps.length,
      latest,
      sampleTimestamps: timestamps.slice(0, 5),
      capabilitiesUrl:
        process.env.GIBS_CAPS_URL ||
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities',
    });
  } catch (e: unknown) {
    const err = e as Error;
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      capabilitiesUrl:
        process.env.GIBS_CAPS_URL ||
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities',
    });
  }
});

// /api/gibs/timestamps?layer=Layer_Id
gibsRouter.get('/timestamps', shortLived60, async (req, res) => {
  try {
    const layer = (req.query.layer as string) || '';
    if (!layer) return res.status(400).json({ error: 'missing layer parameter' });
    const times = await getTimestamps(layer);
    const latest = times.length ? times[times.length - 1] : null;
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ layer, latest, count: times.length, timestamps: times });
  } catch (e: unknown) {
    const err = e as Error;
    const msg = err?.message || 'error';
    if (/gibs_capabilities_fetch_failed/.test(msg))
      return res.status(502).json({ error: 'upstream_capabilities_failed' });
    res.status(500).json({ error: 'timestamps_internal_error', detail: msg });
  }
});

// Latest tile resolver: /api/gibs/tile/:layer/:z/:y/:x.:ext?
gibsRouter.get('/tile/:layer/:z/:y/:x.:ext?', shortLived60, async (req, res) => {
  try {
    const { layer, z, y, x } = req.params;
    const ext = (req.params.ext || 'png').toLowerCase();
    const zN = Number(z),
      yN = Number(y),
      xN = Number(x);
    if (![zN, yN, xN].every(Number.isFinite))
      return res.status(400).json({ error: 'invalid tile coordinates' });

    const explicitTime = (req.query.time as string | undefined)?.trim();
    let chosenTime: string | null;

    if (explicitTime) {
      // Validate the provided time exists among timestamps for the layer
      const ts = await getTimestamps(layer);
      if (!ts.includes(explicitTime)) {
        console.warn(
          `Invalid time requested for layer ${layer}: ${explicitTime}. Available times: ${ts.slice(0, 5).join(', ')}...`,
        );
        return res.status(400).json({
          error: 'invalid time for layer',
          layer,
          time: explicitTime,
          availableCount: ts.length,
          latestAvailable: ts.length > 0 ? ts[ts.length - 1] : null,
        });
      }
      chosenTime = explicitTime;
    } else {
      chosenTime = await getLatestTimestamp(layer);
    }

    if (!chosenTime) {
      console.error(`No timestamps available for layer: ${layer}`);
      return res.status(404).json({ error: 'no timestamps available', layer });
    }

    const tileUrl = await buildTileUrl({
      layerId: layer,
      z: zN,
      y: yN,
      x: xN,
      time: chosenTime,
      ext,
    });

    console.log(`Requesting tile: ${tileUrl}`);

    const injected = (global as { __TEST_FETCH__?: typeof fetch }).__TEST_FETCH__;
    const doFetch: typeof fetch = injected || fetch;
    const upstream = await doFetch(tileUrl);

    if (!upstream.ok) {
      console.error(`Upstream error for ${tileUrl}: ${upstream.status} ${upstream.statusText}`);
      return res.status(upstream.status).json({
        error: 'upstream_error',
        status: upstream.status,
        statusText: upstream.statusText,
        url: tileUrl,
      });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set(
      'Content-Type',
      upstream.headers.get('content-type') || (ext === 'jpg' ? 'image/jpeg' : 'image/png'),
    );
    // shortLived60 already applied; explicit override kept for clarity
    res.set('Cache-Control', 'public, max-age=60');
    return res.send(buf);
  } catch (e: unknown) {
    const err = e as Error;
    console.error(`Tile request error for ${req.params.layer}:`, err);
    res.status(500).json({ error: 'tile_internal_error', detail: err.message });
  }
});

// Backward-compatible legacy geocolor path (delegates to generic if still referenced)
gibsRouter.get('/geocolor/:z/:x/:y.:ext', (req, res) => {
  // Adjust param ordering (legacy had /:z/:x/:y versus new /:z/:y/:x) - map to new route
  const { z, x, y, ext } = req.params;
  res.redirect(302, `/api/gibs/tile/GOES-East_ABI_GeoColor/${z}/${y}/${x}.${ext}`);
});

export const __gibsUtils = { pickTms, buildTileUrl };
