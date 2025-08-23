import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { fetch } from 'undici';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { Histogram, Counter, Registry, collectDefaultMetrics, Gauge } from 'prom-client';

export interface CreateAppOptions {
  allowHosts?: string[];
  s3Bucket?: string;
  s3Client?: S3Client | null; // test injection
}

export function createApp(opts: CreateAppOptions = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(morgan('tiny'));
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

  const ALLOW = (opts.allowHosts || (process.env.ALLOW_HOSTS || 'gibs.earthdata.nasa.gov,opengeo.ncep.noaa.gov,nomads.ncep.noaa.gov')
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
  app.get('/version', (_req: express.Request, res: express.Response) => res.json({ version: pkgVersion }));
  // Prometheus metrics registry & instruments
  const register = new Registry();
  collectDefaultMetrics({ register });
  const proxyRequests = new Counter({ name: 'proxy_requests_total', help: 'Total /proxy requests', registers: [register], labelNames: ['host'] });
  const proxyCacheHits = new Counter({ name: 'proxy_cache_hits_total', help: 'Cache hits', registers: [register], labelNames: ['host'] });
  const proxyCacheMisses = new Counter({ name: 'proxy_cache_misses_total', help: 'Cache misses', registers: [register], labelNames: ['host'] });
  const wmtsRedirects = new Counter({ name: 'wmts_redirects_total', help: 'Total WMTS redirect rewrites', registers: [register] });
  const upstreamErrors = new Counter({ name: 'proxy_upstream_errors_total', help: 'Upstream request errors', registers: [register], labelNames: ['host'] });
  const upstreamStatus = new Counter({ name: 'proxy_upstream_status_total', help: 'Upstream status codes grouped', registers: [register], labelNames: ['code'] });
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
