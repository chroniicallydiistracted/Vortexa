# Changelog

## Unreleased

### Changed
- proxy(cartodb): increase Positron tile cache policy from 1h (max-age=3600) to 24h (max-age=86400, immutable) via new `immutable24h` middleware to align with test expectations and upstream tile stability.

### Added

- Generic GIBS timestamps endpoint and “latest tile” route with small in-memory caches
- Robust WMTS Time parsing (ows:Title + Dimension)
- Proxy tests for caps→tile flow and failure handling
- Explicit `?time=` support on generic GIBS tile route with validation
- GIBS ops polish: rate limiting and tile metrics (status counter & duration histogram)

### Fixed
 - Correct Cache-Control on GIBS responses (60s), consistent with near-real-time cadence
 - Removed aborted GET prefetch causing DOMException; switched to HEAD prefetch
 - Guard against parsing non-JSON responses (content-type check before JSON.parse)
