# API Endpoints

## NASA GIBS

### List timestamps
GET `/api/gibs/timestamps?layer=<LAYER_ID>`

Response
```json
{
  "layer": "GOES-East_ABI_GeoColor",
  "latest": "2025-08-24T19:00:00Z",
  "count": 2,
  "timestamps": ["2025-08-24T18:00:00Z", "2025-08-24T19:00:00Z"]
}
```

Cache: `Cache-Control: public, max-age=60`

Errors
* `400 { "error": "missing layer parameter" }`
* `502 { "error": "upstream_capabilities_failed" }`

### Latest or explicit-time tile
GET `/api/gibs/tile/<LAYER>/<Z>/<Y>/<X>.<ext?>` (default ext=png)

Returns the current latest image tile by default. Provide `?time=<ISO_TIMESTAMP>` to request a specific available timestamp. If the supplied time is not available for that layer the route returns `400 { "error": "invalid time for layer" }`.

Headers
* `Cache-Control: public, max-age=60`
* `Content-Type: image/png` (or image/jpeg for `.jpg` requests)

Errors
* `400 { error: "invalid tile coordinates" }`
* `404 { error: "no timestamps available", layer }`
* `upstream_error` JSON with upstream status mirrored
* `500 { error: "tile_internal_error" }`

### Heuristic (TMS)
* GOES / ABI → `GoogleMapsCompatible_Level8`
* Others → `GoogleMapsCompatible_Level9`

### Legacy redirect
`/api/gibs/geocolor/...` 302 redirects to the generic latest tile endpoint.

### Playback Notes
Client animation uses the timestamps from `/api/gibs/timestamps` and issues tile requests with an explicit `?time=<ISO>` for each frame. The **latest** view omits the `?time` parameter. During playback the client prefetches the next frame's center tile using a `HEAD` request (no body download) to warm connections and reduce perceived flicker. Playback FPS is clamped between 2 and 8 (default 4); user input outside this range is coerced. If fewer than 2 timestamps are available (or timestamp loading fails) the Play control is disabled. An optional `VITE_ENABLE_TILE_CACHE=1` flag enables a MapLibre tile cache size hint (2048) without affecting server behavior.
