import { Router } from 'express';
import axios from 'axios';

export const cartoDbRouter = Router();

// Subdomain rotation (a,b,c,d) based on tile coordinates for cache friendliness
function pickSubdomain(z: number, x: number, y: number) {
  const subs = ['a','b','c','d'];
  return subs[(x + y + z) % subs.length];
}

cartoDbRouter.get('/positron/:z/:x/:y.png', async (req, res) => {
  try {
    const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
    if(!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
      return res.status(400).json({ error: 'invalid tile coords' });
    }
    const sub = pickSubdomain(z,x,y);
    const upstream = `https://${sub}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`;
  const ua = process.env.NWS_USER_AGENT || process.env.USER_AGENT || 'WestFamWeather/0.2 (+contact: chroniicallydiistracted@gmail.com)';
    const r = await axios.get(upstream, { responseType: 'arraybuffer', headers: { 'User-Agent': ua } });
    res.set('Content-Type', 'image/png');
    // Carto base tiles are effectively static; cache for a day (tunable)
    res.set('Cache-Control', 'public, max-age=86400, immutable');
    res.send(Buffer.from(r.data));
  } catch (e: any) {
    res.status(502).json({ error: 'cartodb fetch failed', detail: e.message });
  }
});
