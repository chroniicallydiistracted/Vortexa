#!/usr/bin/env ts-node
/*
 Dynamic external data source health check.
 Iterates over catalog layers and probes endpoints.
*/
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { fetch } from 'undici';
import type { HeadersInit } from 'undici';
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

// ---------------------------------------------------------------------------
// CONFIG / TIME BUDGETS
// Allow overriding via env vars; provide conservative defaults so the script
// cannot appear to "hang" indefinitely if upstreams are slow.
// ---------------------------------------------------------------------------
const MAX_LAYER_MS = Number(process.env.HC_MAX_LAYER_MS || 10000); // hard cap per layer
const MAX_TOTAL_MS = Number(process.env.HC_MAX_TOTAL_MS || 180000); // overall watchdog
const RAINVIEWER_MAX_ATTEMPTS = Number(process.env.RAINVIEWER_MAX_ATTEMPTS || 9); // (timestamps * zooms)
const RAINVIEWER_FETCH_TIMEOUT_MS = Number(process.env.RAINVIEWER_FETCH_TIMEOUT_MS || 1800);
const PROBE_TIMEOUT_MS = Number(process.env.HC_PROBE_TIMEOUT_MS || 8000);
const GIBS_CAP_TIMEOUT_MS = Number(process.env.GIBS_CAP_TIMEOUT_MS || 15000);
const QUIET = process.env.HC_QUIET === '1';

// Load env from repo root fallbacks
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
for (const envPath of [path.join(repoRoot, '.env'), path.join(__dirname, '.env')]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

// Provide safe default env values if not set (non-secret fallbacks for local dev)
function ensureEnv(key: string, fallback: string) {
  if (!process.env[key] || process.env[key] === '') {
    process.env[key] = fallback;
  }
}
ensureEnv('OWM_API_KEY', process.env.OWM_API_KEY || 'DEV_OWM_KEY');
ensureEnv('FIRMS_MAP_KEY', process.env.FIRMS_MAP_KEY || 'DEV_FIRMS_KEY');
ensureEnv(
  'NWS_USER_AGENT',
  process.env.NWS_USER_AGENT || 'WestFamDev/0.1 (contact: dev@example.com)',
);
ensureEnv('ALERTS_TABLE', process.env.ALERTS_TABLE || 'westfam-alerts');
// Optional/secondary auth keys we may need during local checks
ensureEnv('AIRNOW_API_KEY', process.env.AIRNOW_API_KEY || '');
ensureEnv('OPENAQ_API_KEY', process.env.OPENAQ_API_KEY || '');
ensureEnv('CESIUM_ION_TOKEN', process.env.CESIUM_ION_TOKEN || '');
ensureEnv('EARTHDATA_AUTH_KEY', process.env.EARTHDATA_AUTH_KEY || '');
ensureEnv('AWS_ACCESS_KEY_ID', process.env.AWS_ACCESS_KEY_ID || 'test');
ensureEnv('AWS_SECRET_ACCESS_KEY', process.env.AWS_SECRET_ACCESS_KEY || 'test');
ensureEnv('AWS_DEFAULT_REGION', process.env.AWS_DEFAULT_REGION || 'us-west-2');
// Visible summary (masked)
if (!QUIET) {
  console.log('[health-check] Env summary:', {
    OWM_API_KEY: (process.env.OWM_API_KEY || '').slice(0, 6) + '...',
    FIRMS_MAP_KEY: (process.env.FIRMS_MAP_KEY || '').slice(0, 6) + '...',
    NWS_USER_AGENT: process.env.NWS_USER_AGENT,
    ALERTS_TABLE: process.env.ALERTS_TABLE,
  });
  console.log('[health-check] Optional keys:', {
    AIRNOW_API_KEY: (process.env.AIRNOW_API_KEY || '').slice(0, 6) + '...',
    OPENAQ_API_KEY: (process.env.OPENAQ_API_KEY || '').slice(0, 6) + '...',
    CESIUM_ION_TOKEN: (process.env.CESIUM_ION_TOKEN || '').slice(0, 6) + '...',
    EARTHDATA_AUTH_KEY: (process.env.EARTHDATA_AUTH_KEY || '').slice(0, 6) + '...',
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
  });
  console.log('[health-check] Time budgets:', {
    MAX_LAYER_MS,
    MAX_TOTAL_MS,
    RAINVIEWER_MAX_ATTEMPTS,
  });
}

interface Layer {
  slug: string;
  tile_url_template?: string;
  api_endpoint?: string;
  time_format?: string;
  notes?: string;
}

interface Catalog {
  layers: Layer[];
}

// Attempt to locate catalog.json (source of truth is web/public)
const catalogPaths = [
  path.join(repoRoot, 'web', 'public', 'catalog.json'),
  path.join(repoRoot, 'web', 'src', 'data', 'catalog.json'), // future location
];
let catalogFile: string | null = null;
for (const p of catalogPaths) {
  if (fs.existsSync(p)) {
    catalogFile = p;
    break;
  }
}
if (!catalogFile) {
  console.error('Catalog file not found in expected locations');
  process.exit(1);
}
let catalog: Catalog;
try {
  catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
} catch (e) {
  console.error('Failed to parse catalog.json', { file: catalogFile, error: (e as Error).message });
  process.exit(1);
}

const OWM_API_KEY = process.env.OWM_API_KEY || process.env.OPENWEATHERMAP_API_KEY || '';
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || process.env.MAP_KEY || '';

interface Result {
  slug: string;
  status: number | null;
  ok: boolean;
  message: string;
}
const results: Result[] = [];

// --- Managed proxy helpers -------------------------------------------------
interface ManagedProxy {
  proc: ReturnType<typeof spawn> | null;
  started: boolean;
}
const managed: ManagedProxy = { proc: null, started: false };

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => {
      s.close(() => resolve(false));
    });
    s.listen(port, '127.0.0.1');
  });
}

async function forceKillPort(port: number) {
  try {
    const pids = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN || true`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .split(/\s+/)
      .filter(Boolean);
    if (pids.length) {
      console.log(`[health-check] Killing processes on :${port} -> ${pids.join(',')}`);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), 'SIGKILL');
        } catch {}
      }
      // brief wait
      await delay(300);
    }
  } catch {
    /* ignore */
  }
}

async function ensureManagedProxy() {
  const manage = process.env.MANAGE_PROXY !== '0';
  if (!manage) return;
  const needsProxy = catalog.layers.some((l) =>
    (l.tile_url_template || l.api_endpoint || '').startsWith('/'),
  );
  if (!needsProxy) return;
  if (await portInUse(4000)) {
    // Keep killing until port is free or attempts exhausted (handles rapid respawn)
    for (let attempt = 1; attempt <= 4 && (await portInUse(4000)); attempt++) {
      await forceKillPort(4000);
      await delay(150);
    }
  }
  if (!(await portInUse(4000))) {
    console.log('[health-check] Starting managed proxy on :4000');
    // Start minimal proxy (non-watch) via tsx executing src/index.ts
    managed.proc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: path.join(repoRoot, 'services', 'proxy'),
      env: { ...process.env, PORT: '4000', NODE_ENV: 'healthcheck' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    managed.started = true;
    managed.proc.stdout?.on('data', (d) => {
      const line = d.toString();
      if (/proxy up/.test(line)) console.log('[health-check] proxy up');
    });
    managed.proc.stderr?.on('data', (d) => {
      const line = d.toString();
      if (line.toLowerCase().includes('error')) process.stderr.write('[proxy] ' + line);
    });
    // wait for port open (max 6s)
    for (let i = 0; i < 30; i++) {
      if (await portInUse(4000)) {
        await delay(50);
        return;
      }
      await delay(200);
    }
    console.warn('[health-check] WARNING: proxy failed to start within timeout');
  } else {
    console.log(
      '[health-check] Port 4000 already in use after kill attempt; proceeding (assume external proxy).',
    );
  }
}

async function cleanupManagedProxy() {
  if (managed.started && managed.proc) {
    try {
      managed.proc.kill('SIGTERM');
      for (let i = 0; i < 10; i++) {
        if (managed.proc.exitCode != null) break;
        await delay(100);
      }
      if (managed.proc.exitCode == null) managed.proc.kill('SIGKILL');
    } catch {}
  }
}

// --- Dynamic time helpers --------------------------------------------------
let rainviewerCache: { ts: number; timestamps: number[] } | null = null;
const gibsTimeCache = new Map<string, { ts: number; value: string }>();

async function fetchWithTimeout(
  resource: string,
  opts: { timeout?: number; headers?: HeadersInit; method?: string } = {},
) {
  const { timeout = 5000, ...rest } = opts;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function getRainviewerTimestamps(): Promise<number[]> {
  const now = Date.now();
  if (rainviewerCache && now - rainviewerCache.ts < 60_000) return rainviewerCache.timestamps; // 1 min cache
  try {
    const r = await fetchWithTimeout('https://api.rainviewer.com/public/weather-maps.json', {
      timeout: 4000,
    });
    if (r.ok) {
      const data = (await r.json()) as {
        radar?: { past?: { time: number }[]; nowcast?: { time: number }[] };
      };
      const past: number[] = (data.radar?.past || []).map((p) => p.time);
      const nowcast: number[] = (data.radar?.nowcast || []).map((p) => p.time);
      const timestamps = [...past, ...nowcast];
      rainviewerCache = { ts: now, timestamps };
      return timestamps;
    }
  } catch {}
  return [];
}

function mutateZoomXYZ(original: string, zoom: number, x = 0, y = 0): string {
  // Pattern: /{z}/{x}/{y}/2/ just before quality spec
  return original.replace(/\/(\d+)\/(\d+)\/(\d+)\/2\//, `/${zoom}/${x}/${y}/2/`);
}

async function resolveRainviewer(url: string): Promise<string> {
  if (!/tilecache\.rainviewer\.com/.test(url) || !url.includes('{time}')) return url;
  const timestamps = (await getRainviewerTimestamps()).slice(-10); // trim historical scope
  const candidates = [...timestamps].reverse(); // newest first
  const zooms = [0, 1, 2];
  let attempts = 0;
  for (const ts of candidates) {
    for (const z of zooms) {
      if (attempts >= RAINVIEWER_MAX_ATTEMPTS) break;
      attempts++;
      const candidateBase = mutateZoomXYZ(url, z, 0, 0).replace('{time}', String(ts));
      try {
        const r = await fetchWithTimeout(candidateBase, {
          timeout: RAINVIEWER_FETCH_TIMEOUT_MS,
        });
        if (r.status === 200) return candidateBase;
      } catch {
        /* ignore */
      }
    }
    if (attempts >= RAINVIEWER_MAX_ATTEMPTS) break;
  }
  if (candidates.length) return url.replace('{time}', String(candidates[0]));
  return url.replace('{time}', String(Math.floor(Date.now() / 1000)));
}

async function getGibsLatestTime(layerId: string): Promise<string | null> {
  const now = Date.now();
  const cached = gibsTimeCache.get(layerId);
  if (cached && now - cached.ts < 5 * 60_000) return cached.value; // 5 min cache

  const capUrl =
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';
  try {
    if (!QUIET) console.log(`[gibs] Fetching capabilities for ${layerId}...`);
    const r = await fetchWithTimeout(capUrl, { timeout: GIBS_CAP_TIMEOUT_MS });
    if (!r.ok) throw new Error('caps status ' + r.status);
    const xml = await r.text();

    if (!QUIET) console.log(`[gibs] Parsing capabilities XML for ${layerId}...`);
    const escaped = layerId.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const layerRegex = new RegExp(
      `<Layer>[\\s\\S]*?<Identifier>${escaped}<\\/Identifier>[\\s\\S]*?<\\/Layer>`,
      'i',
    );
    const layerBlockMatch = xml.match(layerRegex);
    if (!layerBlockMatch) {
      if (!QUIET) console.log(`[gibs] No layer block found for ${layerId}`);
      return null;
    }
    const block = layerBlockMatch[0];
    const dimMatch =
      block.match(/<Dimension[^>]*name="time"[^>]*>([\s\S]*?)<\/Dimension>/i) ||
      block.match(
        /<Dimension[\s\S]*?(?:name="time"|<Identifier>time<\/Identifier>)[\s\S]*?<Value>([\s\S]*?)<\/Value>/i,
      );
    if (!dimMatch) {
      if (!QUIET) console.log(`[gibs] No time dimension found for ${layerId}`);
      return null;
    }
    const defaultAttr = dimMatch[0].match(/default="([^"]+)"/i);
    let latest: string | null = defaultAttr ? defaultAttr[1] : null;
    if (!latest) {
      const body = dimMatch[1].trim();
      if (body.includes('/P')) {
        const parts = body.split('/');
        if (parts.length >= 2) latest = parts[1];
      } else if (body.includes(',')) {
        latest =
          body
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .pop() || null;
      } else {
        latest = body || null;
      }
    }
    if (latest) {
      if (!QUIET) console.log(`[gibs] Resolved time for ${layerId}: ${latest}`);
      gibsTimeCache.set(layerId, { ts: now, value: latest });
      return latest;
    } else {
      if (!QUIET) console.log(`[gibs] Could not parse time for ${layerId}`);
    }
  } catch (e) {
    if (!QUIET) console.log(`[gibs] Error getting time for ${layerId}:`, (e as Error).message);
  }
  return null;
}

async function resolveGibsTime(url: string): Promise<string> {
  const match = url.match(/best\/([^/]+)\/default\/[^/]+/);
  if (!match) return url;
  const layerId = decodeURIComponent(match[1]);
  const latest = await getGibsLatestTime(layerId);
  if (latest) {
    const safe = encodeURI(latest);
    if (url.includes('{time}')) {
      return url.replace('{time}', safe).replace(/\/default\/[^/]+\//, `/default/${safe}/`);
    }
    return url.replace(/\/default\/[^/]+\//, `/default/${safe}/`);
  }

  // Fallback: try multiple recent dates for better data availability
  const fallbackDates = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    fallbackDates.push(date.toISOString().slice(0, 10));
  }

  // Use 3 days ago as primary fallback (good balance of recency and availability)
  const fallbackStr = fallbackDates[2];

  if (url.includes('{time}')) {
    return url
      .replace('{time}', fallbackStr)
      .replace(/\/default\/[^/]+\//, `/default/${fallbackStr}/`);
  }
  return url.replace(/\/default\/[^/]+\//, `/default/${fallbackStr}/`);
}
async function resolveDynamicTime(layer: Layer, url: string): Promise<string> {
  // Rainviewer
  if (/tilecache\.rainviewer\.com/.test(url) && url.includes('{time}')) {
    return resolveRainviewer(url);
  }
  // GIBS layers
  if (/gibs\.earthdata\.nasa\.gov/.test(url) && /\/default\/[^/]+\//.test(url)) {
    return resolveGibsTime(url);
  }
  return url;
}

async function buildTestUrl(layer: Layer): Promise<string | null> {
  let base = layer.tile_url_template || layer.api_endpoint || '';
  if (!base) return null;
  // Coordinate substitution (radar & GOES may need z/x/y=0)
  const root = layer.slug === 'radar-reflectivity' || layer.slug === 'cloud-top-temperature-height';
  base = base
    .replace('{z}', root ? '0' : '1')
    .replace('{x}', root ? '0' : '1')
    .replace('{y}', root ? '0' : '1');
  // Resolve dynamic time first (GIBS, Rainviewer, etc.)
  base = await resolveDynamicTime(layer, base);

  // Then handle any remaining {time} placeholders with current time
  if (base.includes('{time}')) {
    const now = new Date();
    let timeStr = now.toISOString().slice(0, 10);
    if (layer.time_format === 'unix_timestamp') {
      timeStr = Math.floor(now.getTime() / 1000).toString();
    } else if (layer.time_format === 'YYYY-MM-DDTHH:mm:ssZ') {
      timeStr = now.toISOString().slice(0, 19) + 'Z';
    } else if (layer.time_format === 'YYYY-MM-DDTHHmmZ') {
      const pad = (n: number) => n.toString().padStart(2, '0');
      timeStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}00Z`;
    }
    base = base.replace('{time}', encodeURIComponent(timeStr));
  }

  if (base.includes('YOUR_API_KEY')) {
    if (base.includes('OWM')) base = base.replace('YOUR_API_KEY', OWM_API_KEY || 'MISSING');
    else base = base.replace('YOUR_API_KEY', 'MISSING');
  }
  return base;
}

async function probe(url: string, slug: string): Promise<Result> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal, method: 'GET' });
    clearTimeout(to);
    const status = r.status;
    if (status === 200) return { slug, status, ok: true, message: 'SUCCESS' };
    if (status === 401 || status === 403) return { slug, status, ok: false, message: 'AUTH' };
    if (status === 404) return { slug, status, ok: false, message: 'NOT_FOUND' };
    return { slug, status, ok: false, message: `STATUS_${status}` };
  } catch (e: any) {
    return {
      slug,
      status: null,
      ok: false,
      message: e.name === 'AbortError' ? 'TIMEOUT' : e.message || 'ERROR',
    };
  }
}

const devPlaceholderKeys = new Set(['DEV_OWM_KEY', 'DEV_FIRMS_KEY', 'MISSING']);
let watchdog: NodeJS.Timeout | null = null;

async function main() {
  const startAll = Date.now();
  watchdog = setTimeout(() => {
    console.error('[health-check] Global watchdog exceeded', { MAX_TOTAL_MS });
    cleanupManagedProxy().then(() => process.exit(98));
  }, MAX_TOTAL_MS).unref();
  await ensureManagedProxy();
  console.log(`Catalog layers: ${catalog.layers.length}`);
  const missingConfig: string[] = [];
  if (!OWM_API_KEY) missingConfig.push('OWM_API_KEY');
  if (!FIRMS_MAP_KEY) missingConfig.push('FIRMS_MAP_KEY');
  if (missingConfig.length) {
    console.log(
      `Config notice: missing ${missingConfig.join(', ')} may cause AUTH or TIMEOUT results.`,
    );
  }
  for (const layer of catalog.layers) {
    const layerStart = Date.now();
    const url = await buildTestUrl(layer);
    if (!url) {
      results.push({
        slug: layer.slug,
        status: null,
        ok: false,
        message: 'NO_URL',
      });
      continue;
    }
    const isPlaceholder = /\/tiles\/(gfs|hrrr)\//.test(url);
    if (isPlaceholder) {
      results.push({
        slug: layer.slug,
        status: 404,
        ok: false,
        message: 'PLACEHOLDER_SKIPPED',
      });
      continue;
    }
    let finalUrl = url;
    if (finalUrl.startsWith('/')) {
      const base = process.env.HEALTH_BASE_URL || 'http://localhost:4000';
      finalUrl = base + finalUrl;
    }
    if (!QUIET) console.log(`→ Probing ${layer.slug} -> ${finalUrl}`);
    let res: Result | null = null;
    try {
      res = await Promise.race([
        probe(finalUrl, layer.slug),
        (async () => {
          await delay(MAX_LAYER_MS);
          return {
            slug: layer.slug,
            status: null,
            ok: false,
            message: 'LAYER_TIMEOUT',
          } as Result;
        })(),
      ]);
    } catch (e: unknown) {
      const err = e as Error;
      res = {
        slug: layer.slug,
        status: null,
        ok: false,
        message: err?.message || 'ERROR',
      };
    }
    if (layer.slug === 'cloud-top-temperature-height' && res.status === 400) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const alt = finalUrl.replace(/\/default\/current\//, `/default/${today}/`);
        const retry = await probe(alt, layer.slug);
        if (retry.ok) res = retry;
      } catch {
        /* ignore */
      }
    }
    if (layer.slug === 'official-weather-alerts' && res.status === 500) {
      res.message = 'ALERTS_BACKEND_MISSING';
    }
    if (layer.slug.startsWith('precipitation') && res.status === 400) {
      res.message = 'LAYER_NAME_OR_PARAMS';
    }
    if (
      /^temperature$|^wind$|^total-cloud-cover$|^mean-sea-level-pressure$|^precipitation-type$/.test(
        layer.slug,
      ) &&
      res.status === 401 &&
      devPlaceholderKeys.has((OWM_API_KEY || '').split(/[,;]/)[0])
    ) {
      res.message = 'CONFIG_MISSING';
    }
    if (!QUIET) {
      const elapsed = Date.now() - layerStart;
      console.log(`   ↳ ${layer.slug} finished in ${elapsed}ms (${res.message})`);
    }
    results.push(res);
    await delay(75); // shorter delay since we now cap per-layer
  }
  console.log('\nResults:');
  for (const r of results) {
    let icon = r.ok
      ? '✅'
      : r.message === 'NOT_FOUND' || r.message === 'PLACEHOLDER_SKIPPED'
        ? '⚠️'
        : '❌';
    const statusTxt = r.status === null ? '' : `(${r.status})`;
    console.log(`${icon} ${r.slug} ${statusTxt} ${r.message}`);
  }
  const summary = {
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok && r.message !== 'PLACEHOLDER_SKIPPED').length,
    placeholders: results.filter((r) => r.message === 'PLACEHOLDER_SKIPPED').length,
  };
  console.log('\nSummary:', summary);
  if (summary.failures > 0) process.exitCode = 2;
  const totalElapsed = Date.now() - startAll;
  if (!QUIET) console.log(`[health-check] Total elapsed ${totalElapsed}ms`);
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
  await cleanupManagedProxy();
  // Force exit to avoid lingering handles (defensive)
  const code = process.exitCode ?? 0;
  process.exit(code);
}

main().catch((err) => {
  console.error('[health-check] Fatal error', err);
  if (watchdog) clearTimeout(watchdog);
  cleanupManagedProxy().then(() => process.exit(99));
});
