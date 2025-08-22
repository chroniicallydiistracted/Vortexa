import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { fetch } from 'undici';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import morgan from 'morgan';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));
// Simple hard-coded cache headers for tiles
app.use((_req, res, next)=>{ res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

const PORT = process.env.PORT || 4000;
const ALLOW = (process.env.ALLOW_HOSTS || 'gibs.earthdata.nasa.gov,opengeo.ncep.noaa.gov,nomads.ncep.noaa.gov').split(',').map(s=>s.trim());
const S3_BUCKET = process.env.S3_BUCKET || '';
const s3 = S3_BUCKET ? new S3Client({}) : null;

function allowHost(url: string){
  try {
    const h = new URL(url).host;
  return ALLOW.includes(h) || ALLOW.includes(h.replace(/^www\./,''));
  } catch { return false; }
}

app.get('/health', (_req,res)=> res.json({ ok:true }));

// Simple WMS/WMTS passthrough with optional S3 cache
app.get('/proxy', async (req,res)=>{
  const target = req.query.url as string;
  if(!target || !allowHost(target)) return res.status(400).json({ error:'blocked or missing url' });
  const cacheKey = crypto.createHash('sha1').update(target).digest('hex');
  try {
    if(s3){
      try {
        const get = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: cacheKey }));
        res.set('Content-Type', get.ContentType || 'application/octet-stream');
        (get.Body as any).pipe(res);
        return;
      } catch {}
    }
    const upstream = await fetch(target);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    const buf = Buffer.from(await upstream.arrayBuffer());
    if(s3){
      await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: cacheKey, Body: buf, ContentType: upstream.headers.get('content-type') || undefined, CacheControl: 'public, max-age=600' }));
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buf);
  } catch (e:any){
    logger.error(e);
    res.status(500).json({ error: e.message });
  }
});

// WMTS shorthand: /tiles/wmts?base=...&layer=...&z={z}&x={x}&y={y}
app.get('/tiles/wmts', async (req,res)=>{
  const { base, layer, x, y, z, format, time } = req.query as any;
  if(!base || !layer) return res.status(400).json({ error:'missing base/layer' });
  // Normalize common GIBS patterns:
  // Accept bases like:
  // - https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi
  // - https://gibs.earthdata.nasa.gov/wmts
  // - https://gibs.earthdata.nasa.gov
  const b = String(base).replace(/\/$/, '');
  let root = b;
  // Strip known wmts suffixes
  root = root.replace(/\/wmts\/epsg3857\/best\/wmts\.cgi$/i, '/wmts')
             .replace(/\/wmts\/epsg3857\/best$/i, '/wmts')
             .replace(/\/wmts\/wmts\.cgi$/i, '/wmts');
  if(!/\/wmts$/i.test(root)) root = `${root}/wmts`;
  const ext = String(format || 'png').toLowerCase();
  const timePart = time ? `?time=${encodeURIComponent(String(time))}` : '';
  const tileUrl = `${root}/epsg3857/best/${encodeURIComponent(layer)}/default/current/GoogleMapsCompatible/${z}/${y}/${x}.${ext}${timePart}`;
  return res.redirect(307, `/proxy?url=${encodeURIComponent(tileUrl)}`);
});

app.listen(PORT, ()=> logger.info({ msg:'proxy up', port: PORT }));
