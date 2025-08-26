import { Router, Request, Response } from 'express';
import { NWS_USER_AGENT, requireEnv } from '../config/creds.js';

// Thin proxy that ensures NWS User-Agent header is set for api.weather.gov
// Example: /api/nws/alerts/active?status=actual
export const nwsRouter = Router();

nwsRouter.get('/*', async (req: Request, res: Response) => {
  requireEnv('NWS_USER_AGENT', NWS_USER_AGENT);
  const tail = req.params[0] || '';
  const qs = req.originalUrl.split('?')[1];
  const full = qs ? `https://api.weather.gov/${tail}?${qs}` : `https://api.weather.gov/${tail}`;

  const r = await fetch(full, {
    headers: {
      'User-Agent': NWS_USER_AGENT,
      Accept: 'application/geo+json, application/json;q=0.9',
    },
  });
  if (!r.ok) {
    res
      .status(r.status)
      .type('text/plain')
      .send(await r.text());
    return;
  }
  const ct = r.headers.get('content-type') || 'application/json';
  res.setHeader('Content-Type', ct);
  const buf = Buffer.from(await r.arrayBuffer());
  res.send(buf);
});
