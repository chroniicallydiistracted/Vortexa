import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { fetch } from 'undici';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'node:crypto';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { Histogram, Counter, Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { firmsRouter } from './routes/firms.js';
import { owmRouter } from './routes/owm.js';
import { nwsRouter } from './routes/nws.js';
import { cartoDbRouter } from './routes/cartodb.js';
import { gibsRouter } from './routes/gibs.js';

export interface CreateAppOptions {
  allowHosts?: string[];
  s3Bucket?: string;
  s3Client?: S3Client | null; // test injection
}

export function createApp(opts: CreateAppOptions = {}) {
  const app = express();
  app.use(cors());
  // Static asset serving (web public assets & Cesium) for dev / simple deployment
  // Resolve repo root heuristically so tests (cwd=services/proxy) still find /web/public
  const candidateRoots = [process.cwd(), path.join(process.cwd(),'..'), path.join(process.cwd(),'..','..')];
  let webPublic: string | null = null;
  for (const root of candidateRoots) {
    const p = path.join(root, 'web', 'public');
    if (fs.existsSync(p)) { webPublic = p; break; }
  }
  if (webPublic) {
    app.use(express.static(webPublic, { extensions: ['html'], index: false, setHeaders(res, filePath){
      if (/\.svg$/i.test(filePath)) res.type('image/svg+xml');
    }}));
  }
  const cesiumPath = path.join(process.cwd(), 'web', 'node_modules', 'cesium', 'Build', 'Cesium');
  if (fs.existsSync(cesiumPath)) {
    app.use('/cesium', express.static(cesiumPath));
  }
  app.use(express.json());
  app.use(morgan('tiny'));
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

  const ALLOW = (opts.allowHosts || (process.env.ALLOW_HOSTS || 'gibs.earthdata.nasa.gov,opengeo.ncep.noaa.gov,nomads.ncep.noaa.gov,basemaps.cartocdn.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean));
  const S3_BUCKET = opts.s3Bucket ?? (process.env.S3_BUCKET || '');
  const s3 = S3_BUCKET ? (opts.s3Client ?? new S3Client({})) : null;
  if (!S3_BUCKET) {
    logger.info({ msg: 'cache: disabled' });
  } else {
    logger.info({ msg: `cache: s3://${S3_BUCKET}` });
  }

  let pkgVersion = '0.0.0';
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || pkgVersion;
  } catch { /* ignore */ }

  function allowHost(url: string) {
    try {
      const h = new URL(url).host;
      const ok = ALLOW.includes(h) || ALLOW.includes(h.replace(/^www\./, ''));
      if (!ok) {
        logger.warn({ msg: 'rejecting upstream host', host: h, allow: ALLOW });
      }
      return ok;
    } catch (_e) {
      logger.warn({ msg: 'invalid url', url });
      return false;
    }
  }

  app.get('/health', (_req: express.Request, res: express.Response) => res.json({ ok: true }));
  app.get('/healthz', (_req: express.Request, res: express.Response) => res.json({ status: 'ok', upstreams: ALLOW, time: new Date().toISOString() }));
  // Deep health (cached) – verifies upstream data fetches & DynamoDB access
  interface DeepHealthComponent<T = any> { ok: boolean; error?: string; data?: T; latency_ms?: number }
  interface DeepHealthPayload {
    ok: boolean;
    generated_at: string;
    ttl_ms: number;
    components: {
      upstream_hosts: Record<string, DeepHealthComponent<{ status: number }>>;
      rainviewer: DeepHealthComponent<{ frames: number; past: number; nowcast: number; age_ms: number }>;
      gibs_goes_b13: DeepHealthComponent<{ latestTime: string | null }>;
      dynamodb_alerts: DeepHealthComponent<{ table: string; itemCount?: number }>;
    }
  }
  let deepHealthCache: { ts: number; payload: DeepHealthPayload } | null = null;
  async function runDeepHealth(): Promise<DeepHealthPayload> {
    const upstream_hosts: Record<string, DeepHealthComponent<{ status: number }>> = {};
    const timeoutMs = Number(process.env.DEEP_HEALTH_TIMEOUT_MS || 4000);
    const globalTimeoutMs = Number(process.env.DEEP_HEALTH_GLOBAL_TIMEOUT_MS || 8000);
    // Limit parallelism to avoid DNS/socket saturation causing perceived hang
    const maxConcurrent = Number(process.env.DEEP_HEALTH_CONCURRENCY || 3);
    const hosts = [...ALLOW];
    let idx = 0;
    async function checkHost(h: string) {
      const url = /^https?:/i.test(h) ? h : `https://${h}/`;
      const ac = new AbortController();
      const timer = setTimeout(()=> ac.abort(), timeoutMs);
      const t0 = Date.now();
      try {
        let resp = await fetch(url, { method: 'HEAD', signal: ac.signal });
        if(!resp.ok && resp.status >= 400 && resp.status < 500) {
          // HEAD sometimes blocked; retry GET quickly
          try { resp = await fetch(url, { signal: ac.signal }); } catch {/* ignore if fails */}
        }
        clearTimeout(timer);
        upstream_hosts[h] = { ok: resp.ok, data: { status: resp.status }, latency_ms: Date.now() - t0 };
      } catch (e: any) {
        clearTimeout(timer);
        upstream_hosts[h] = { ok: false, error: e.name === 'AbortError' ? 'timeout' : (e.message || 'error'), latency_ms: Date.now() - t0 };
      }
    }
    async function runQueue() {
      const workers: Promise<void>[] = [];
      for (let c = 0; c < maxConcurrent && idx < hosts.length; c++) {
        const h = hosts[idx++];
        workers.push(checkHost(h));
      }
      await Promise.all(workers);
      if (idx < hosts.length) return runQueue();
    }
    const globalAbort = new Promise<never>((_, reject)=> setTimeout(()=> reject(new Error('deep_health_global_timeout')), globalTimeoutMs));
    try {
      await Promise.race([runQueue(), globalAbort]);
    } catch (e:any) {
      // Mark remaining hosts as timeout if global timeout hit
      if(e.message === 'deep_health_global_timeout') {
        for(let i=idx;i<hosts.length;i++) upstream_hosts[hosts[i]] = { ok:false, error:'global_timeout' };
      }
    }
    // Rainviewer meta
    let rainviewer: DeepHealthComponent<{ frames: number; past: number; nowcast: number; age_ms: number }>;
    try {
      const meta = await loadRainviewerMeta();
      const frames = meta.past.length + meta.nowcast.length;
      rainviewer = { ok: frames > 0, data: { frames, past: meta.past.length, nowcast: meta.nowcast.length, age_ms: Date.now() - meta.ts } };
      if(frames === 0) rainviewer.error = 'no frames';
    } catch (e: any) {
      rainviewer = { ok: false, error: e.message || 'rainviewer_failed' };
    }
    // GIBS GOES Band 13 timestamp
    let gibs_goes_b13: DeepHealthComponent<{ latestTime: string | null }>;
    try {
      const ts = await getGoesB13Timestamp();
      gibs_goes_b13 = { ok: !!ts, data: { latestTime: ts || null } };
      if(!ts) gibs_goes_b13.error = 'timestamp_unavailable';
    } catch (e: any) {
      gibs_goes_b13 = { ok: false, error: e.message || 'gibs_failed' };
    }
    // DynamoDB alerts table (lightweight scan limit 1)
    let dynamodb_alerts: DeepHealthComponent<{ table: string; itemCount?: number }>;
    try {
      const data = await ddbDoc.send(new ScanCommand({ TableName: alertsTable, Limit: 1 }));
      dynamodb_alerts = { ok: true, data: { table: alertsTable, itemCount: (data.ScannedCount || 0) } };
    } catch (e: any) {
      dynamodb_alerts = { ok: false, error: e.message || 'ddb_failed', data: { table: alertsTable } };
    }
    const ok = Object.values(upstream_hosts).every(c=> c.ok) && rainviewer.ok && gibs_goes_b13.ok && dynamodb_alerts.ok;
    return {
      ok,
      generated_at: new Date().toISOString(),
      ttl_ms: 30000,
      components: { upstream_hosts, rainviewer, gibs_goes_b13, dynamodb_alerts }
    };
  }
  app.get('/health/deep', async (req, res) => {
    try {
      const force = 'force' in req.query;
      const now = Date.now();
      if(!force && deepHealthCache && (now - deepHealthCache.ts) < deepHealthCache.payload.ttl_ms) {
        return res.status(deepHealthCache.payload.ok ? 200 : 503).json({ cached: true, age_ms: now - deepHealthCache.ts, ...deepHealthCache.payload });
      }
      const payload = await runDeepHealth();
      deepHealthCache = { ts: Date.now(), payload };
      res.status(payload.ok ? 200 : 503).json({ cached: false, ...payload });
    } catch (e: any) {
      res.status(500).json({ ok:false, error: e.message || 'deep_health_failed' });
    }
  });
  app.get('/version', (_req: express.Request, res: express.Response) => res.json({ version: pkgVersion }));
  // Feature flags (runtime kill-switch for experimental features like 3D globe)
  app.get('/api/flags', (_req: express.Request, res: express.Response) => {
    const enable3d = process.env.ENABLE_3D === '1';
    res.json({ enable3d });
  });
  // Vendor proxied APIs (credentials / headers enforced)
  app.use('/api/firms', firmsRouter);
  app.use('/api/owm', owmRouter);
  app.use('/api/nws', nwsRouter);
  app.use('/api/cartodb', cartoDbRouter);
  // --- Rate limiting for /api/gibs/* (token bucket per-IP) ---
  interface Bucket { tokens: number; last: number }
  const gibsBurst = Number(process.env.GIBS_RATE_BURST || 20);
  const gibsRefill = Number(process.env.GIBS_RATE_REFILL_PER_SEC || 10);
  const gibsBuckets = new Map<string, Bucket>();
  function gibsTake(ip: string): boolean {
    const now = Date.now();
    let b = gibsBuckets.get(ip);
    if(!b){ b = { tokens: gibsBurst, last: now }; gibsBuckets.set(ip, b); }
    const dt = (now - b.last)/1000;
    if(dt > 0){ b.tokens = Math.min(gibsBurst, b.tokens + dt * gibsRefill); b.last = now; }
    if(b.tokens >= 1){ b.tokens -= 1; return true; }
    return false;
  }
  app.use('/api/gibs', (req, res, next) => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/,'');
    if(!gibsTake(ip)) return res.status(429).json({ error: 'rate_limited' });
    next();
  }, gibsRouter);

  // --- Dynamic timestamped layers (Rainviewer radar & GIBS GOES Band 13) ---
  // In-memory caches to avoid excessive upstream metadata fetches
  interface RainviewerEntry { time: number; path: string }
  let rainviewerMeta: { ts: number; past: RainviewerEntry[]; nowcast: RainviewerEntry[] } = { ts: 0, past: [], nowcast: [] };
  async function loadRainviewerMeta(): Promise<typeof rainviewerMeta> {
    const now = Date.now();
    if (rainviewerMeta.past.length && (now - rainviewerMeta.ts) < 60_000) return rainviewerMeta;
    try {
      const rv = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!rv.ok) return rainviewerMeta;
      const data: any = await rv.json();
      rainviewerMeta = {
        ts: now,
        past: (data?.radar?.past || []).map((p: any)=> ({ time: p.time, path: p.path })),
        nowcast: (data?.radar?.nowcast || []).map((p: any)=> ({ time: p.time, path: p.path }))
      };
    } catch {/* keep old cache */}
    return rainviewerMeta;
  }
  function buildRainviewerTileUrl(entry: RainviewerEntry, z: string, x: string, y: string): string {
    // Use 256 tiles for low zoom (<=2) to save bandwidth; otherwise 512 for smoother view
    const size = Number(z) <= 2 ? 256 : 512;
    // Entry path already contains /v2/radar/<timestamp or nowcast_id>
    return `https://tilecache.rainviewer.com${entry.path}/${size}/${z}/${x}/${y}/2/1_1.png`;
  }
  app.get('/api/radar/tiles/:z/:x/:y.png', async (req, res) => {
    try {
      const meta = await loadRainviewerMeta();
      const { z, x, y } = req.params;
      // Prefer most recent nowcast frame; fallback to latest past if needed
      const ordered = [...meta.nowcast.slice().sort((a,b)=> a.time - b.time), ...meta.past.slice().sort((a,b)=> a.time - b.time)];
      for (let i = ordered.length - 1; i >= 0; i--) {
        const entry = ordered[i];
        const tileUrl = buildRainviewerTileUrl(entry, z, x, y);
        const upstream = await fetch(tileUrl);
        if (upstream.ok) {
          res.set('Content-Type', upstream.headers.get('content-type') || 'image/png');
          res.set('Cache-Control', 'public, max-age=120'); // short cache, frames update frequently
          return res.send(Buffer.from(await upstream.arrayBuffer()));
        }
      }
      return res.status(503).json({ error: 'no_radar_frame_available' });
    } catch (e: any) {
      logger.error({ msg: 'radar proxy failed', error: e.message });
      res.status(500).json({ error: 'radar_proxy_failed' });
    }
  });

  let goesB13Meta: { ts: number; latest: string | null } = { ts: 0, latest: null };
  async function getGoesB13Timestamp(): Promise<string | null> {
    const now = Date.now();
    if (goesB13Meta.latest && (now - goesB13Meta.ts) < 5 * 60_000) return goesB13Meta.latest; // 5 min cache
    try {
      const cap = await fetch('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml');
      if (!cap.ok) return goesB13Meta.latest;
      const xml = await cap.text();
      // Extract layer block for GOES-East_Full_Disk_Band_13_ENHANCED
      const layerIdx = xml.indexOf('GOES-East_Full_Disk_Band_13_ENHANCED');
      if (layerIdx === -1) return goesB13Meta.latest;
      const slice = xml.slice(Math.max(0, layerIdx - 2000), layerIdx + 4000); // window around layer name
      // Grab nearest <Dimension>...</Dimension> containing <Default>
      const dimMatch = slice.match(/<Dimension[^>]*>[^<]*<Identifier>time<\/Identifier>[\s\S]*?<Default>([^<]+)<\/Default>/i);
      if (dimMatch && dimMatch[1]) {
        goesB13Meta = { ts: now, latest: dimMatch[1].trim() };
      }
      return goesB13Meta.latest;
    } catch {
      return goesB13Meta.latest;
    }
  }
  app.get('/api/gibs/goes-b13/:z/:y/:x.png', async (req, res) => {
    try {
      const ts = await getGoesB13Timestamp();
      if (!ts) return res.status(503).json({ error: 'timestamp_unavailable' });
      const { z, y, x } = req.params; // GIBS order /{z}/{y}/{x}
      const tileUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_Full_Disk_Band_13_ENHANCED/default/${encodeURIComponent(ts)}/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`;
      const gibsStart = Date.now();
      const upstream = await fetch(tileUrl);
      const gibsDur = Date.now() - gibsStart;
      gibsTileDuration.observe(gibsDur);
      gibsTileStatus.inc({ code: String(upstream.status) });
      if (!upstream.ok) return res.status(upstream.status).send();
      res.set('Content-Type', upstream.headers.get('content-type') || 'image/png');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (e: any) {
      logger.error({ msg: 'goes-b13 proxy failed', error: e.message });
      res.status(500).json({ error: 'goes_b13_proxy_failed' });
    }
  });
  // Prometheus metrics registry & instruments
  const register = new Registry();
  collectDefaultMetrics({ register });
  const proxyRequests = new Counter({ name: 'proxy_requests_total', help: 'Total /proxy requests', registers: [register], labelNames: ['host'] });
  const proxyCacheHits = new Counter({ name: 'proxy_cache_hits_total', help: 'Cache hits', registers: [register], labelNames: ['host'] });
  const proxyCacheMisses = new Counter({ name: 'proxy_cache_misses_total', help: 'Cache misses', registers: [register], labelNames: ['host'] });
  const wmtsRedirects = new Counter({ name: 'wmts_redirects_total', help: 'Total WMTS redirect rewrites', registers: [register] });
  const upstreamErrors = new Counter({ name: 'proxy_upstream_errors_total', help: 'Upstream request errors', registers: [register], labelNames: ['host'] });
  const upstreamStatus = new Counter({ name: 'proxy_upstream_status_total', help: 'Upstream status codes grouped', registers: [register], labelNames: ['code'] });
  // GIBS specific metrics (status + duration)
  const gibsTileStatus = new Counter({ name: 'gibs_tile_upstream_status', help: 'Upstream status for GIBS tile fetch', registers: [register], labelNames: ['code'] });
  const gibsTileDuration = new Histogram({ name: 'gibs_tile_duration_ms', help: 'Duration of GIBS tile upstream fetch (ms)', registers: [register], buckets: [50,100,200,400,800,1600] });
  const requestDuration = new Histogram({ name: 'proxy_request_duration_seconds', help: 'Upstream fetch duration seconds', registers: [register], labelNames: ['host'], buckets: [0.05,0.1,0.25,0.5,1,2,5,10] });
  const cacheHitRatio = new Gauge({ name: 'proxy_cache_hit_ratio', help: 'Cache hit ratio (hits / (hits+misses))', registers: [register] });

  async function updateHitRatio() {
    function sumCounter(c: Counter) {
      const data = (c as any).hashMap || {};
      return Object.values(data).reduce((a: number, v: any) => a + (typeof v.value === 'number' ? v.value : 0), 0);
    }
    const hitsVal = sumCounter(proxyCacheHits);
    const missVal = sumCounter(proxyCacheMisses);
    const total = hitsVal + missVal;
    cacheHitRatio.set(total === 0 ? 0 : hitsVal / total);
  }
  setInterval(updateHitRatio, 10000).unref();

  app.get('/metrics', async (_req: express.Request, res: express.Response) => {
    try {
      await updateHitRatio();
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  });


  // Alerts endpoint (GeoJSON FeatureCollection)
  const alertsTable = process.env.ALERTS_TABLE || 'westfam-alerts';
  const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;
  const _ddb = new DynamoDBClient({
    region: 'us-west-2',
    ...(dynamoEndpoint ? { endpoint: dynamoEndpoint } : {})
  });
  const ddbDoc = DynamoDBDocumentClient.from(_ddb);
  app.get('/api/alerts', async (_req, res) => {
    try {
      const data = await ddbDoc.send(new ScanCommand({ TableName: alertsTable, Limit: 1000 }));
      const items = (data.Items || []).map((it: any) => {
        // Expect structure { pk:'alert#<id>', data: { ...CAP alert... } }
        const raw = (it as any).data || (it as any).alert || it;
        const geom = raw?.geometry || raw?.features?.[0]?.geometry || null; // fallback attempt
        return {
          type: 'Feature',
            geometry: geom,
            properties: {
              id: raw?.id || (it as any).pk || undefined,
              event: raw?.properties?.event || raw?.event,
              headline: raw?.properties?.headline || raw?.headline,
              severity: raw?.properties?.severity || raw?.severity,
              certainty: raw?.properties?.certainty || raw?.certainty,
              effective: raw?.properties?.effective || raw?.effective,
              expires: raw?.properties?.expires || raw?.expires
            }
        };
      }).filter((f: any)=> f.geometry);
      res.json({ type: 'FeatureCollection', features: items });
    } catch (e: any) {
      logger.error({ msg: 'alerts scan failed', error: e.message });
      res.status(500).json({ error: 'failed to load alerts' });
    }
  });

  // Cache config (host/path TTL + size guard)
  interface CacheRule { host: string; pathPrefix: string; ttlSeconds: number }
  interface CacheConfig { maxObjectBytes: number; defaultTTLSeconds: number; rules: CacheRule[] }
  let cacheConfig: CacheConfig | null = null;
  const configPath = path.join(process.cwd(), 'services', 'proxy', 'src', 'config', 'cache.config.json');
  try {
    if (fs.existsSync(configPath)) {
      cacheConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as CacheConfig;
      logger.info({ msg: 'cache.config loaded', path: configPath });
    }
  } catch (e) {
    logger.warn({ msg: 'failed to load cache.config.json', error: (e as any).message });
  }

  function resolveTTL(host: string, urlPath: string): number {
    if (!cacheConfig) return 300;
    for (const r of cacheConfig.rules) {
      if (r.host === host && urlPath.startsWith(r.pathPrefix)) return r.ttlSeconds;
    }
    return cacheConfig.defaultTTLSeconds;
  }

  app.get('/proxy', async (req: express.Request, res: express.Response) => {
    const target = req.query.url as string;
    if (!target) {
      return res.status(400).json({ error: 'missing url' });
    }
    if (!allowHost(target)) {
      return res.status(400).json({ error: 'blocked host' });
    }
    const cacheKey = crypto.createHash('sha1').update(target).digest('hex');
    const host = (() => { try { return new URL(target).host; } catch { return 'invalid'; } })();
    try {
      proxyRequests.inc({ host });
      if (s3) {
        try {
          const get = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: cacheKey }));
          res.set('Content-Type', get.ContentType || 'application/octet-stream');
          (get.Body as any).pipe(res);
          proxyCacheHits.inc({ host });
          updateHitRatio();
          return;
        } catch { /* cache miss */ }
      }
      if (s3) { proxyCacheMisses.inc({ host }); updateHitRatio(); }
      const ac = new AbortController();
      const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 20000);
      const to = setTimeout(() => ac.abort(), timeoutMs);
      const start = process.hrtime.bigint();
      const upstream = await fetch(target);
      const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
      requestDuration.observe({ host }, elapsed);
      clearTimeout(to);
      const status = upstream.status;
      upstreamStatus.inc({ code: String(Math.floor(status / 100) * 100) });
      res.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (s3 && cacheConfig && buf.length > cacheConfig.maxObjectBytes) {
        logger.info({ msg: 'skip cache: size guard', bytes: buf.length, limit: cacheConfig.maxObjectBytes });
      }
      if (s3) {
        if (!cacheConfig || buf.length <= cacheConfig.maxObjectBytes) {
          const pathPart = (() => { try { return new URL(target).pathname; } catch { return '/'; } })();
          const ttl = resolveTTL(host, pathPart);
          await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: cacheKey, Body: buf, ContentType: upstream.headers.get('content-type') || undefined, CacheControl: `public, max-age=${ttl}` }));
        }
      }
      res.set('Cache-Control', `public, max-age=${resolveTTL(host, (() => { try { return new URL(target).pathname; } catch { return '/'; } })())}`);
      res.send(buf);
    } catch (e: any) {
      upstreamErrors.inc({ host });
      logger.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/tiles/wmts', async (req: express.Request, res: express.Response) => {
    const { base, layer, x, y, z, format, time } = req.query as any;
    if (!base || !layer) return res.status(400).json({ error: 'missing base/layer' });
    const b = String(base).replace(/\/$/, '');
    let root = b;
    root = root.replace(/\/wmts\/epsg3857\/best\/wmts\.cgi$/i, '/wmts')
      .replace(/\/wmts\/epsg3857\/best$/i, '/wmts')
      .replace(/\/wmts\/wmts\.cgi$/i, '/wmts');
    if (!/\/wmts$/i.test(root)) root = `${root}/wmts`;
    const ext = String(format || 'png').toLowerCase();
    const timePart = time ? `?time=${encodeURIComponent(String(time))}` : '';
    const tileUrl = `${root}/epsg3857/best/${encodeURIComponent(layer)}/default/current/GoogleMapsCompatible/${z}/${y}/${x}.${ext}${timePart}`;
  wmtsRedirects.inc();
  return res.redirect(307, `/proxy?url=${encodeURIComponent(tileUrl)}`);
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  const app = createApp();
  app.listen(PORT, () => logger.info({ msg: 'proxy up', port: PORT }));
}
