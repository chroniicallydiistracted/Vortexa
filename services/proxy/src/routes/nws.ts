import { Router, Request, Response } from 'express';
import { NWS_USER_AGENT, requireEnv } from '../config/creds.js';

export const nwsRouter = Router();

nwsRouter.get('/*', async (req: Request, res: Response) => {
  try {
    requireEnv('NWS_USER_AGENT', NWS_USER_AGENT);
    const tail = req.params[0] || '';
    const qs = req.originalUrl.split('?')[1];
    const full = qs ? `https://api.weather.gov/${tail}?${qs}` : `https://api.weather.gov/${tail}`;

    const r = await fetch(full, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        Accept:
          (req.headers['accept'] as string) ||
          'application/geo+json,application/json;q=0.9,*/*;q=0.1',
      },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      res
        .status(r.status)
        .type('text/plain')
        .send(text || 'upstream_error');
      return;
    }
    const ct = r.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res
      .status(502)
      .json({ error: 'nws_proxy_failed', message: (e as Error).message || 'fetch_failed' });
  }
});
