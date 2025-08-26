import { Router, Request, Response } from 'express';
import { OWM_API_KEY } from '../config/creds.js';

// Hide OWM API key behind proxy.
// Example: /api/owm/tiles/precipitation_new/5/5/12.png
export const owmRouter = Router();

owmRouter.get('/tiles/:layer/:z/:x/:y.png', async (req: Request, res: Response) => {
  if (!OWM_API_KEY) {
    res.status(500).json({ error: 'OWM_API_KEY not configured' });
    return;
  }
  const { layer, z, x, y } = req.params;
  const url = `https://tile.openweathermap.org/map/${encodeURIComponent(layer)}/${z}/${x}/${y}.png?appid=${OWM_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) {
    res
      .status(r.status)
      .type('text/plain')
      .send(await r.text());
    return;
  }
  res.setHeader('Content-Type', 'image/png');
  const buf = Buffer.from(await r.arrayBuffer());
  res.send(buf);
});
