import { Router, Request, Response } from 'express';
import { NWS_USER_AGENT, requireEnv } from '../config/creds.js';

export const nwsRouter = Router();

nwsRouter.get('/*', async (req: Request, res: Response) => {
  try {
    requireEnv('NWS_USER_AGENT', NWS_USER_AGENT);
    let tail = req.params[0] || '';
    if (tail === 'alerts') tail = 'alerts/active';
    const qs = req.originalUrl.split('?')[1];
    const full = qs ? `https://api.weather.gov/${tail}?${qs}` : `https://api.weather.gov/${tail}`;

    const r = await fetch(full, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        Accept: 'application/geo+json',
      },
    });

    const ct = r.headers.get('content-type') || 'application/json';
    const body = await r.text();
    res
      .status(r.status)
      .type(ct)
      .send(body || (r.ok ? '{}' : 'upstream_error'));
  } catch (e) {
    res
      .status(502)
      .json({ error: 'nws_proxy_failed', message: (e as Error).message || 'fetch_failed' });
  }
});
