import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { fetch } from 'undici';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';

export interface CreateAppOptions {
  allowHosts?: string[];
  s3Bucket?: string;
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
  const s3 = S3_BUCKET ? new S3Client({}) : null;
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

  app.get('/proxy', async (req: express.Request, res: express.Response) => {
    const target = req.query.url as string;
    if (!target) {
      return res.status(400).json({ error: 'missing url' });
    }
    if (!allowHost(target)) {
      return res.status(400).json({ error: 'blocked host' });
    }
    const cacheKey = crypto.createHash('sha1').update(target).digest('hex');
    try {
      if (s3) {
        try {
          const get = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: cacheKey }));
          res.set('Content-Type', get.ContentType || 'application/octet-stream');
          (get.Body as any).pipe(res);
          return;
        } catch { /* cache miss */ }
      }
      const upstream = await fetch(target);
      res.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (s3) {
        await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: cacheKey, Body: buf, ContentType: upstream.headers.get('content-type') || undefined, CacheControl: 'public, max-age=600' }));
      }
      res.set('Cache-Control', 'public, max-age=300');
      res.send(buf);
    } catch (e: any) {
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
    return res.redirect(307, `/proxy?url=${encodeURIComponent(tileUrl)}`);
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  const app = createApp();
  app.listen(PORT, () => logger.info({ msg: 'proxy up', port: PORT }));
}
