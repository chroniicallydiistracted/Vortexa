import { Router, Request, Response } from 'express';
import { OWM_API_KEY } from '../config/creds.js';

export const owmRouter = Router();

owmRouter.get('/tiles/:layer/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    if (!OWM_API_KEY) {
      res.status(500).json({ error: 'OWM_API_KEY not configured' });
      return;
    }
    const { layer, z, x, y } = req.params;
    const url = `https://tile.openweathermap.org/map/${encodeURIComponent(layer)}/${z}/${x}/${y}.png?appid=${OWM_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      res
        .status(r.status)
        .type('text/plain')
        .send(text || 'upstream_error');
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res
      .status(502)
      .json({ error: 'owm_proxy_failed', message: (e as Error).message || 'fetch_failed' });
  }
});
