import { fetch } from 'undici';
import { LRUCache } from 'lru-cache';

const DEFAULT_CAPS_URL =
  process.env.GIBS_CAPS_URL ||
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';
const DEFAULT_TILE_BASE =
  process.env.GIBS_TILE_BASE || 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

// Simple TTL cache wrappers
const capsCache = new LRUCache<string, string>({ max: 32, ttl: 60_000 }); // raw XML per key (currently single key)
const tsCache = new LRUCache<string, string[]>({ max: 256, ttl: 60_000 }); // timestamps per layer
const latestCache = new LRUCache<string, string | null>({ max: 256, ttl: 60_000 }); // latest timestamp per layer

export async function getCapabilitiesXML(): Promise<string> {
  const key = 'caps';
  const cached = capsCache.get(key);
  if (cached) return cached;
  // Allow test injection of fetch
  const injected = (global as { __TEST_FETCH__?: typeof fetch }).__TEST_FETCH__;
  const doFetch: typeof fetch = injected || fetch;
  const r = await doFetch(DEFAULT_CAPS_URL);
  if (!r.ok) throw new Error('gibs_capabilities_fetch_failed');
  const xml = await r.text();
  capsCache.set(key, xml);
  return xml;
}

// Extract timestamps for a layer by regex (avoid heavy XML lib)
export async function getTimestamps(layerId: string): Promise<string[]> {
  if (tsCache.has(layerId)) return tsCache.get(layerId)!;
  const xml = await getCapabilitiesXML();
  const escaped = layerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Look for Layer blocks by Identifier, not Title
  const layerRegex = new RegExp(
    `<Layer>[\\s\\S]*?<ows:Identifier>\\s*${escaped}\\s*<\\/ows:Identifier>[\\s\\S]*?<\\/Layer>`,
    'i',
  );
  const layerBlockMatch = xml.match(layerRegex);
  if (!layerBlockMatch) {
    tsCache.set(layerId, []);
    return [];
  }
  const layerBlock = layerBlockMatch[0];
  
  // Look for all Value elements within the Time dimension using a compatible approach
  const valueRegex = /<Dimension[\s\S]*?<ows:Identifier>Time<\/ows:Identifier>[\s\S]*?<Value>([\s\S]*?)<\/Value>/gi;
  const times: string[] = [];
  let match;
  
  while ((match = valueRegex.exec(layerBlock)) !== null) {
    const raw = match[1];
    // Split on commas or whitespace; keep date tokens
    const tokens = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    
    // Process each token to extract timestamps
    for (const token of tokens) {
      if (token.includes('/')) {
        // Handle period format like "2025-08-15T12:00:00Z/2025-08-15T12:30:00Z/PT10M"
        const parts = token.split('/');
        if (parts.length >= 2) {
          // Add both start and end times
          const startTime = parts[0];
          const endTime = parts[1];
          
          // Validate ISO8601 format
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(startTime)) {
            times.push(startTime);
          }
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(endTime)) {
            times.push(endTime);
          }
        }
      } else {
        // Handle single timestamp
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(token)) {
          times.push(token);
        }
      }
    }
  }
  
  // Remove duplicates and sort using a compatible approach
  const uniqueTimes: string[] = [];
  for (const time of times) {
    if (uniqueTimes.indexOf(time) === -1) {
      uniqueTimes.push(time);
    }
  }
  uniqueTimes.sort();
  
  tsCache.set(layerId, uniqueTimes);
  return uniqueTimes;
}

export async function getLatestTimestamp(layerId: string): Promise<string | null> {
  if (latestCache.has(layerId)) return latestCache.get(layerId)!;
  const xml = await getCapabilitiesXML();
  const escaped = layerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Look for Layer blocks by Identifier, not Title
  const layerRegex = new RegExp(
    `<Layer>[\\s\\S]*?<ows:Identifier>\\s*${escaped}\\s*<\\/ows:Identifier>[\\s\\S]*?<\\/Layer>`,
    'i',
  );
  const layerBlockMatch = xml.match(layerRegex);
  if (!layerBlockMatch) {
    latestCache.set(layerId, null);
    return null;
  }
  const layerBlock = layerBlockMatch[0];
  
  // First check for Default attribute in the Time dimension
  const defaultMatch = layerBlock.match(
    /<Dimension[\s\S]*?<ows:Identifier>Time<\/ows:Identifier>[\s\S]*?<Default>([^<]+)<\/Default>/i
  );
  
  if (defaultMatch) {
    const defaultTime = defaultMatch[1].trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(defaultTime)) {
      latestCache.set(layerId, defaultTime);
      return defaultTime;
    }
  }
  
  // If no default, get all timestamps and use the latest
  const timestamps = await getTimestamps(layerId);
  if (timestamps.length === 0) {
    latestCache.set(layerId, null);
    return null;
  }
  
  // Sort timestamps and get the latest
  const sorted = timestamps.sort();
  const latest = sorted[sorted.length - 1];
  latestCache.set(layerId, latest);
  return latest;
}

export function pickTms(
  layerId: string,
): 'GoogleMapsCompatible_Level7' | 'GoogleMapsCompatible_Level8' | 'GoogleMapsCompatible_Level9' | 'GoogleMapsCompatible_Level13' {
  // Based on the XML, GOES layers use Level7, Graticule uses Level13
  if (/GOES|ABI/i.test(layerId)) return 'GoogleMapsCompatible_Level7';
  if (/Graticule/i.test(layerId)) return 'GoogleMapsCompatible_Level13';
  // Default fallback
  return 'GoogleMapsCompatible_Level8';
}

export interface BuildTileUrlOpts {
  layerId: string;
  z: number;
  y: number;
  x: number;
  time: string;
  tms?: string;
  ext?: string;
}

export function buildTileUrl({ layerId, z, y, x, time, tms, ext }: BuildTileUrlOpts): string {
  const tmsSet = tms || pickTms(layerId);
  const extension = (ext || 'png').toLowerCase();
  const safeTime = encodeURI(time);
  
  // Use the correct WMTS URL structure from the XML specification
  // Format: /{layerId}/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.{ext}
  return `${DEFAULT_TILE_BASE}/${layerId}/default/${safeTime}/${tmsSet}/${z}/${y}/${x}.${extension}`;
}

// For tests
export const __internals = { capsCache, tsCache, latestCache };
