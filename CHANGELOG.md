# Changelog

## Unreleased

### Added

* Generic GIBS timestamps endpoint and “latest tile” route with small in-memory caches
* Robust WMTS Time parsing (ows:Title + Dimension)
* Proxy tests for caps→tile flow and failure handling
* Explicit `?time=` support on generic GIBS tile route with validation

### Fixed

* Correct Cache-Control on GIBS responses (60s), consistent with near-real-time cadence
