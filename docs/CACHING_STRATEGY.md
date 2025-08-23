# Caching Strategy

Guidance for tile/data caching to balance performance and cost.

## Goals
- Reduce upstream tile latency (target p95 < 400ms)
- Minimize duplicate fetch costs (egress + origin rate limiting)
- Preserve freshness where required (alerts) while aggressively caching static/slow-changing assets.

## Layers & Suggested TTLs
| Category | Example | Volatility | Suggested CDN TTL | Suggested S3 Tile Cache TTL |
| -------- | ------- | ---------- | ----------------- | --------------------------- |
| Base map | OSM vector | Low | 24h | 7d |
| Satellite (GeoColor) | GOES-East recent frames | High (per 5-10 min) | 2-5m | 10m |
| Radar composite | NEXRAD mosaic | High (5 min) | 2-5m | 10m |
| Static legends | Legend PNG/SVG | None | 7d | 30d |

Adjust based on real usage and acceptable staleness.

## Proxy Cache Notes
- Current S3 cache writes objects with `CacheControl: 'public, max-age=600'` (10m) and serves responses with `public, max-age=300` (5m) to clients.
- Consider differentiating TTL by host or path (future enhancement) via a small rule table.
- Avoid caching responses >5MB (future safeguard) to control S3 costs; implement size check before PutObject.

## Invalidation Strategy
- Prefer natural TTL expiry over manual invalidations for cost reasons.
- For emergency purge (bad layer): remove objects with matching prefix hash or bump versioned query param (e.g., `?v=2`).

## Metrics & Monitoring
- `/metrics` exposes basic counters; extend with per-host cache hit ratio and average fetch latency.
- Target cache hit ratio for moderately volatile layers: ≥ 60% after warm-up.

## Future Enhancements
- Prometheus integration & dashboard (hit ratio, latency, error rate).
- Layer-specific TTL mapping (config file).
- Pre-warming critical tiles (viewport-based) on deploy.

## Cost Considerations
- S3 request + storage cost vs upstream egress: caching helps when tiles are reused ≥2 times within TTL.
- Periodically sample object size distribution to adjust TTLs for large assets.

## Action Items
- [ ] Add size guard to proxy before caching.
- [ ] Add host/path TTL config.
- [ ] Export latency histogram (Prometheus client).
- [ ] Track hit ratio over time.