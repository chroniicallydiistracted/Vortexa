import { Router, Request, Response } from 'express';
import { FIRMS_MAP_KEY, NWS_USER_AGENT, requireEnv } from '../config/creds.js';

export const firmsRouter = Router();

firmsRouter.get('/:source/:days', async (req: Request, res: Response) => {
  try {
    requireEnv('FIRMS_MAP_KEY', FIRMS_MAP_KEY);
    const { source, days } = req.params;
    const daysNum = Math.max(1, Math.min(10, Number(days) || 1));

    // Correct endpoint form:
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${encodeURIComponent(source)}/world/${daysNum}`;

    const r = await fetch(url, {
      headers: { 'User-Agent': NWS_USER_AGENT || 'Vortexa/1.0 (proxy)' },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      res.status(r.status).type('text/plain').send(text || 'upstream_error');
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(await r.text());
  } catch (e) {
    res.status(502).json({ error: 'firms_proxy_failed', message: (e as Error).message || 'fetch_failed' });
  }
});
