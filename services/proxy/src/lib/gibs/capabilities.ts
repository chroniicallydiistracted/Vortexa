import { fetch } from "undici";
import { LRUCache } from "lru-cache";

const DEFAULT_CAPS_URL =
  process.env.GIBS_CAPS_URL ||
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities";
const DEFAULT_TILE_BASE =
  process.env.GIBS_TILE_BASE ||
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

// Simple TTL cache wrappers
const capsCache = new LRUCache<string, string>({ max: 32, ttl: 60_000 }); // raw XML per key (currently single key)
const tsCache = new LRUCache<string, string[]>({ max: 256, ttl: 60_000 }); // timestamps per layer

export async function getCapabilitiesXML(): Promise<string> {
  const key = "caps";
  const cached = capsCache.get(key);
  if (cached) return cached;
  // Allow test injection of fetch
  const injected = (global as { __TEST_FETCH__?: typeof fetch }).__TEST_FETCH__;
  const doFetch: typeof fetch = injected || fetch;
  const r = await doFetch(DEFAULT_CAPS_URL);
  if (!r.ok) throw new Error("gibs_capabilities_fetch_failed");
  const xml = await r.text();
  capsCache.set(key, xml);
  return xml;
}

// Extract timestamps for a layer by regex (avoid heavy XML lib)
export async function getTimestamps(layerId: string): Promise<string[]> {
  if (tsCache.has(layerId)) return tsCache.get(layerId)!;
  const xml = await getCapabilitiesXML();
  const escaped = layerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Support <Title> or <ows:Title>
  const layerRegex = new RegExp(
    `<Layer>[\\s\\S]*?<(?:(?:ows:)?Title)>\\s*${escaped}\\s*<\\/(?:ows:)?Title>[\\s\\S]*?<\\/Layer>`,
    "i",
  );
  const layerBlockMatch = xml.match(layerRegex);
  if (!layerBlockMatch) {
    tsCache.set(layerId, []);
    return [];
  }
  const layerBlock = layerBlockMatch[0];
  // dimension variations: name="time" or <Dimension><Identifier>time</Identifier><Value>...</Value>
  const dimMatch =
    layerBlock.match(
      /<Dimension[^>]*name=\"time\"[^>]*>([\s\S]*?)<\/Dimension>/i,
    ) ||
    layerBlock.match(
      /<Dimension[\s\S]*?(?:name=\"time\"|<Identifier>time<\/Identifier>)[\s\S]*?<Value>([\s\S]*?)<\/Value>/i,
    );
  if (!dimMatch) {
    tsCache.set(layerId, []);
    return [];
  }
  const raw = dimMatch[1];
  // Split on commas or whitespace; keep ISO-like tokens
  const tokens = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const times = tokens
    .filter((t) => /^\d{4}-\d{2}-\d{2}T\d{2}:?\d{2}:?\d{2}Z$/.test(t))
    .sort();
  tsCache.set(layerId, times);
  return times;
}

export async function getLatestTimestamp(
  layerId: string,
): Promise<string | null> {
  const times = await getTimestamps(layerId);
  return times.length ? times[times.length - 1] : null;
}

export function pickTms(
  layerId: string,
): "GoogleMapsCompatible_Level8" | "GoogleMapsCompatible_Level9" {
  // Heuristic: GOES / ABI layers go Level8 else Level9
  return /GOES|ABI/i.test(layerId)
    ? "GoogleMapsCompatible_Level8"
    : "GoogleMapsCompatible_Level9";
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

export function buildTileUrl({
  layerId,
  z,
  y,
  x,
  time,
  tms,
  ext,
}: BuildTileUrlOpts): string {
  const tmsSet = tms || pickTms(layerId);
  const extension = (ext || "png").toLowerCase();
  const safeTime = encodeURIComponent(time);
  return `${DEFAULT_TILE_BASE}/${layerId}/default/${safeTime}/${tmsSet}/${z}/${y}/${x}.${extension}`;
}

// For tests
export const __internals = { capsCache, tsCache };
