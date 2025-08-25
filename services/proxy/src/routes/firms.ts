import { Router, Request, Response } from "express";
import { FIRMS_MAP_KEY, NWS_USER_AGENT, requireEnv } from "../config/creds.js";

// FIRMS (Global) — pass‑through CSV for hotspots using 'area/world' endpoint.
// Example: GET /api/firms/VIIRS_NOAA20_NRT/1  -> last 24h, global
export const firmsRouter = Router();

firmsRouter.get("/:source/:days", async (req: Request, res: Response) => {
  requireEnv("FIRMS_MAP_KEY", FIRMS_MAP_KEY);
  const { source, days } = req.params;
  const daysNum = Math.max(1, Math.min(10, Number(days) || 1)); // guardrails
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${encodeURIComponent(source)}/world/${daysNum}`;
  const r = await fetch(url, {
    headers: { "User-Agent": NWS_USER_AGENT || "Vortexa/1.0 (proxy)" },
  });
  if (!r.ok) {
    res
      .status(r.status)
      .type("text/plain")
      .send(await r.text());
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send(await r.text());
});
