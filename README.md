# WestFam Weather — AWS‑ready Foundation

This repository is a **starter monorepo** for an all‑in‑one weather & earth science dashboard.
It currently provides a production‑leaning baseline consisting of:

* **Web App (React/Vite/TS + MapLibre)** with dynamic layer catalog, timeline playback, vector + raster sources, geocoding search, and FIRMS CSV → GeoJSON conversion.
* **Tile / Data Proxy (Node/Express/TypeScript)** with WMTS normalization, upstream allow‑list, optional S3 caching hooks, and vendor credential shielding (FIRMS, OpenWeatherMap tiles, NWS w/ required User‑Agent header).
* **Alerts Lambda (Node)** storing alert FeatureCollections in DynamoDB and exposing a GeoJSON endpoint `/api/alerts` via the proxy.
* **Cloud Dev Scripts** (`scripts/cloud-dev.sh` / `cloud-dev-down.sh`) to provision (or reuse) the DynamoDB table, seed a sample alert, and concurrently launch proxy + web for iterative development.

> Active data layer catalog now lives at `web/public/catalog.json` (authoritative). Earlier reference to `data/catalog.json` was removed; that file is no longer the live source.

## High‑level architecture
- **Web (React/Vite/TS + MapLibre)**: Layer registry (raster + vector), timeline animator (hourly stepping & looping), geocode search (Nominatim), FIRMS CSV ingestion, panel UI.
- **Proxy (Node/Express/TS)**: WMTS normalization, credential shielding routes (`/api/owm`, `/api/firms`, `/api/nws`), alerts endpoint (DynamoDB scan), metrics endpoint (Prometheus), optional S3 cache (config file hook).
- **Alerts Lambda (Node)**: Seeds / manages sample alert records (schema: `pk`, `sk`, `data`).
- **(Placeholders)**: Ingest pipeline & model tiling endpoints (`/tiles/gfs/...`, `/tiles/hrrr/...`) not yet implemented.

## Quickstart (local dev)

1) Install deps & build shared types
	- From repo root: `npm i`
	- Build shared (optional, most scripts build on demand): `npm -w services/shared run build`
2) Start full cloud‑simulated dev stack (recommended):
	- `scripts/cloud-dev.sh` (ensures DynamoDB table, seeds sample alert, launches proxy + web)
3) Or start individual services:
	- Proxy: `npm -w services/proxy run dev` (port 4000)
	- Web: `npm -w web run dev` (port 5173)
4) Catalog layers appear in the side panel; select a raster (e.g., Radar, Satellite) or a vector layer (e.g., Active Fires via proxied FIRMS CSV) to render.

Notes:
- Vendor secrets (FIRMS MAP_KEY, OpenWeatherMap API key, NWS_USER_AGENT) are **only** read server‑side in proxy routes; the web bundle uses proxied endpoints (no `appid=` leakage).
- Proxy upstream allow‑list currently: `gibs.earthdata.nasa.gov, opengeo.ncep.noaa.gov, nomads.ncep.noaa.gov` plus any additional hosts required by credentialled vendor routes (FIRMS, OWM, NWS) handled internally.
- Ingest & model tiling pipelines are not yet implemented; placeholders exist for future expansion.
- Terraform infra present (buckets, DynamoDB, etc.), but ECS/Fargate or API Gateway integration for the proxy is not yet codified.

## Quick start (local dev)
```bash
# Node 20+ recommended
npm -v && node -v

# Install workspaces
npm i

# Start proxy + web
npm run dev
```

### Cloud Dev Script (DynamoDB + Concurrent Services)
`scripts/cloud-dev.sh` provisions (or reuses) the DynamoDB table (`westfam-alerts`), seeds a sample alert through the lambda code path, then launches proxy + web concurrently. Use `--recreate` to force table deletion/recreate, `--no-seed` to skip seeding. Shutdown with `scripts/cloud-dev-down.sh` (add `--hard` for SIGKILL fallback, `--keep-table` to retain the table).

### Alerts Lambda (Seed / Placeholder)
Currently seeds sample alert data. Full CAP ingest (poll + dedupe + TTL metadata enrichment) is **not yet implemented**.

### Convenience Scripts Recap
- `npm run dev` → Concurrent web + proxy (preferred)
- `npm run dev:all` → Legacy alias kept for reference

> Tip: Add a simple seed script under `scripts/seed-alerts-local.ts` later to automate the demo item insert shown above.

## Testing
Run all tests (proxy, alerts, shared types):
```bash
npm run test
```
Add tests when changing behavior. Proxy tests live in `services/proxy/src/*.test.ts`.

## Environment Variables
Root / proxy relevant:
* `FIRMS_MAP_KEY` – required for `/api/firms` (CSV hotspots)
* `OWM_API_KEY` – required for `/api/owm/tiles/...`
* `NWS_USER_AGENT` – required (policy) for `/api/nws/*`
* `ALERTS_TABLE` – override DynamoDB table name (default `westfam-alerts`)
* `ALLOW_HOSTS` – comma list of additional upstream hosts (strict allow‑list enforcement)
* `S3_BUCKET` – enable S3 caching when set (see `services/proxy/src/config/cache.config.json` template)

Web:
* Uses proxied endpoints; no weather vendor secrets should appear in built bundle.

Terraform variables: bucket/domain/region (see `infra/terraform/terraform.tfvars`).

## Deploy (AWS)
1. Ensure Terraform and AWS credentials (or OIDC from GitHub Actions).
2. `cd infra/terraform && terraform init && terraform apply`.
3. `npm run deploy` (builds web to S3, updates Lambda/ECR images).

See `docs/DEPLOY.md` for details.

---

## Implementation Status (Snapshot)

### Fully Implemented
* Layer catalog (`web/public/catalog.json`) with raster (Rainviewer radar, GIBS MODIS True Color, GOES IR, OpenWeatherMap tiles via proxy) + vector (alerts, earthquakes, FIRMS fires via CSV → GeoJSON) entries.
* Proxy credential shielding routes: `/api/owm`, `/api/firms`, `/api/nws` with environment‑driven secrets; no keys in client code.
* Timeline playback (looping, hourly stepping) and time substitution across multiple formats (unix timestamp, date, ISO second, compact hour format).
* Vector ingestion & styling (lines, polygons, points) + FIRMS CSV parsing utility.
* Cloud dev scripts for table ensure/seed and graceful shutdown.
* Prometheus metrics endpoint, health/version endpoints, WMTS normalization endpoint.
* Automated tests (proxy: health, metrics, cache flow, vendor route happy paths; placeholders for other workspaces).

### Partially Implemented
* Alerts Lambda: sample data seeding only (no scheduled CAP feed, no TTL lifecycle logic).
* S3 tile caching: code path & config hooks exist; production cache bucket + policies not provisioned.
* Model layers (GFS / HRRR) present as catalog placeholders; backend tiling endpoints not built.
* Radar & satellite time dimension: dynamic timestamp discovery (Rainviewer available frames, GIBS available times) not yet integrated (currently uses "now").
* Duplicate alerts overlay: static `/api/alerts` auto‑load plus optional catalog layer—consolidation pending.
* CI secrets wiring added; deployment of proxy with those secrets still requires infra module (API Gateway / ECS) not yet in Terraform.

### Not Yet Implemented / Planned
* Ingest pipeline (GRIB processing, model tile generation, nowcasting).
* ECS Fargate or Lambda packaging for proxy (Terraform module & deployment automation).
* User auth/preferences, notification subscription & push delivery.
* Advanced performance optimizations (code splitting beyond baseline, progressive layer loading strategies).
* Automated dynamic timestamp services & caching for time‑aware layers.
* Enhanced FIRMS styling (confidence/FRP‑driven symbology) and point clustering.
* Full test coverage for error branches (vendor key missing, upstream failures).

---

## Removed / Deprecated (Historic References)
* `data/catalog.json` (legacy location) – replaced by `web/public/catalog.json` authoritative schema.
* Local Docker DynamoDB workflow instructions superseded by `cloud-dev.sh` automation.

