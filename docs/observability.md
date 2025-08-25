# Observability

## GIBS Tile Metrics

The proxy exposes the following GIBS-specific instruments (Prometheus):

* `gibs_tile_upstream_status{code}` – counter of upstream HTTP status codes for GIBS tile fetches (including legacy goes-b13 helper).
* `gibs_tile_duration_ms` – histogram (buckets: 50,100,200,400,800,1600 ms) recording upstream fetch latency per tile.

These complement the existing generic proxy metrics (request counts, cache hit ratios, etc.).

## Rate Limiting

A lightweight per-IP token bucket protects `/api/gibs/*`:

* Default burst: 20
* Refill: 10 tokens / second
* Overrides via environment: `GIBS_RATE_BURST`, `GIBS_RATE_REFILL_PER_SEC`
* Over limit → `429 { "error": "rate_limited" }`

## Example PromQL

Upstream error rate (5xx) over last 5 minutes:
```
sum(rate(gibs_tile_upstream_status{code=~"5.."}[5m]))
  /
clamp_min(sum(rate(gibs_tile_upstream_status[5m])), 1)
```

p95 tile duration (ms) last 15 minutes:
```
histogram_quantile(0.95, sum(rate(gibs_tile_duration_ms_bucket[15m])) by (le))
```

Sustained 429 (rate limit) alert candidate:
```
sum(rate(http_requests_total{path=~"/api/gibs/.*",status="429"}[5m])) > 1
```

(Replace `http_requests_total` with actual 429 metric if exported separately; the limiter currently only affects request path logic.)

## Operational Notes

* Limiter is intentionally generous; typical playback should not trip it.
* If animation becomes choppy under real load, inspect `gibs_tile_duration_ms` p95 / p99 and consider prefetch or FPS reduction.
* Status code spikes (e.g., 503) often correlate with upstream maintenance windows.
