# VISION.md

## WestFam Weather — All-in-One Weather & Earth Science Dashboard

### Mission

Deliver a **comprehensive, real-time, and predictive weather + earth-science platform** that unifies satellite basemaps, radar, models, hazards, and alerts into a single, fast, reliable dashboard—built to run **24/7 for family use** with **low operational cost** and **AWS-first** infrastructure.

### Product North Star (“Windy.com++”)

- Match the clarity and speed of best-in-class map UIs, then go further with **declarative data onboarding**, **policy-compliant ingest**, and **budget discipline**.
- Be the tool storm-curious users trust during real events and the site they casually check daily.

---

## Goals

### 1) Unification of Data Sources

- Integrate global and U.S. sources behind a catalog (declarative entries, versioned):
  - **NOAA/NWS** (api.weather.gov: alerts, radar mosaics), **NASA GIBS** (GOES, VIIRS, MODIS), **GFS/HRRR/ICON/ECMWF** model fields, **MRMS**, **USGS**, **FIRMS**, **AirNow** (keyed), with room for additional vetted feeds.

- Normalize access patterns (WMTS/XYZ, JSON/GeoJSON) via a single proxy and typed adapters.

### 2) High-Performance Visualization

- Interactive WebGL map with **multi-layer blending**, **time controls** (recent loop), and **scrubbable timelines**.
- Optimized defaults: **one clean basemap** + **minimal, meaningful overlays**; no “layer zoo” on first load.
- WMTS time support for satellite loops; optional **radar + IR/GeoColor fusion** as a preset.

### 3) Forecasting & Predictive Insights

- **Nowcasting** (short-term extrapolation) where feasible and cheap.
- Mid/long-range **model visualization** (e.g., GFS/ICON/ECMWF) as overlays with explicit metadata and timestamps.
- Event modules: **tropical tracks**, **severe probabilities**, **aurora KP/oval** preview.

### 4) Alerting & Notification System

- **NWS + CAP** alerts ingestion, deduped and persisted with TTL.
- User-targeted notifications (email/SMS/web push) with filters (location, type, severity) and quiet hours.

### 5) Personalization & Accessibility

- Location-aware defaults, saved views, layer presets, and shareable URLs.
- PWA support (installable; last-known alert cache for brief offline use).
- Accessibility: color-safe palettes, readable contrasts, large hit targets on mobile.

### 6) Scalable Infrastructure (AWS-first)

- **S3 + CloudFront (OAC)** for static hosting/tiles; **Lambda + EventBridge** for schedulers/alerts; **DynamoDB** for alerts & state; **Fargate or Lambda** for tile proxy as traffic warrants.
- Guardrails: simple to operate, least-privilege IAM, cost ceiling enforced by design.&#x20;

---

## Scope & Phasing

### V1 (MVP, production-grade)

- Static React app (Vite) on **S3 + CloudFront (OAC, HTTPS)**.
- **Tile proxy** normalizing GIBS WMTS; demo layers: **GOES-East/West ABI GeoColor**.
- **NWS Alerts** Lambda (Node 20) on **EventBridge rate(5m)** → DynamoDB (`pk`, `sk`, `ttl`).
- **DNS**: Cloudflare authoritative for apex; **Route 53 delegated zone** for `weather.westfam.media` pointing to CloudFront.
- **Cost**: operate in low single digits per month under normal usage.

### V1.1 (Polish + Quality)

- Time slider for satellite loops (3–6h recent).
- Layer presets, shareable permalinks.
- Optional **S3 cache** for proxy, simple alarms (Lambda errors, 5xx bursts), log retention.

### V2 (Nice-to-have)

- **AirNow** AQ overlays, **FIRMS fires**, **USGS** seismic/hydro layers.
- Basic auth for private overlays.
- Mobile-first refinements, offline “last-known alerts” mode.

---

## Architecture (Baseline)

**Frontend**: React + Vite; small JS bundles; TanStack Query for data.
**Delivery**: S3 (private) + CloudFront with OAC; ACM cert in us-east-1; custom domain `weather.westfam.media`.
**Proxy**: Node/Express TS; WMTS normalization (GIBS et al.); optional S3 tile cache; CORS; allow-list.
**Alerts**: Lambda (Node 20) + DynamoDB; idempotent upserts; TTL for natural cleanup.
**Infra**: Terraform managing S3 blocks, CloudFront, ACM, DynamoDB, Lambda, EventBridge, Route 53 delegation.&#x20;

---

## Data Sources (Initial Catalog)

- **NWS**: alerts (policy requires **custom User-Agent + contact email**).
- **NASA GIBS**: GOES-East/West **GeoColor/IR/true color** WMTS (public; base path quirks normalized).
- Future: **AirNow** (key), **FIRMS** (some CSV/JSON require Earthdata login), **USGS** (public).

---

## Basemap & Layer Strategy

### Default Basemap (performance-first)

- Lightweight, attribution-clean vector or raster basemap (e.g., OSM/Carto-light equivalent) via reliable CDN or self-served tiles (if cached).
- **Satellite is not the base by default**; it’s a toggle overlay to avoid megabyte-heavy first paint.

### GOES East vs West & Near-Global Coverage

- **GOES-East (75°W)**: Americas/Atlantic; **GOES-West (137°W)**: Pacific/West Coast.
- Strategy:
  - **Auto-switch** GOES layer by viewport center (East/West) with a seamless boundary and user override.
  - Optional **blend/edge fade** in overlap region to minimize seam artifacts.
  - For broader coverage, add polar imagery (e.g., **VIIRS “Black Marble” night** or **Blue Marble** static) when out of GOES FOV.

---

## Non-Functional Requirements & Guardrails

**Reliability**: ≥ 99.5% monthly availability for the dashboard.
**Latency**: p95 HTML < 150 ms at edge; p95 tile < 400 ms (normal upstream).
**Cost**: typical ≤ **\$10/mo**, burst ≤ **\$20/mo**.
**Security**: S3 private + Public Access Block; OAC to web bucket; least-privilege IAM; no public write APIs.
**Compliance**: NWS policy (custom UA, rate limits), vendor terms respected.

---

## Operations

- **Observability**: CloudWatch logs (14-day retention), minimal alarms (Lambda errors, 5xx), health endpoints for proxy.
- **Backups/TTL**: Alerts in DynamoDB with TTL; static deploys are immutable artifacts (rollbacks via versioned objects).
- **Runbooks**: One-pager for domain, cert, deploy, and “panic button” rollback.

---

## Domain & DNS

- **Authoritative**: **Cloudflare** for `westfam.media` (unchanged).
- **Delegation**: **Route 53 hosted zone** for `weather.westfam.media`; NS set in Cloudflare.
- **Records** (in the delegated zone):
  - `A`/`AAAA` **alias** to CloudFront distribution.
  - **ACM validation CNAME(s)** as issued by us-east-1 certificate.

---

## Success Criteria

- First paint < 2.5 s broadband / < 5 s LTE average; tile pan/zoom is smooth; no broken layers on smoke tests.
- NWS alerts ingested within minutes; deduped and visible with correct polygons.
- Month-over-month cost within the target band; < 1 manual intervention/month.
- Family actually uses it; feedback loop drives phased improvements.

---

## Definition of Done (check when verified in **production**)

- [ ] S3 web/data buckets **private** with Public Access Block; OAC configured.
- [ ] CloudFront serves `index.html`; ACM (us-east-1) validated; HTTPS on custom domain.
- [ ] Delegated DNS resolves: `weather.westfam.media` → CloudFront; cert CNAMEs present.
- [ ] Tile proxy live; **GOES-East/West GeoColor** renders via WMTS through proxy.
- [ ] Alerts Lambda scheduled; writes to DynamoDB; **TTL enabled**; no error alarms.
- [ ] Basic alarms and log retention (≥ 14 days) configured.
- [ ] README and `.env` examples match reality; NWS **User-Agent** documented and set.
- [ ] Cost sampled after a week under normal use; within budget.

---

## Risks & Mitigations

- **Upstream instability** (GIBS, NWS outages): retries, cache headers, graceful fallbacks, clear UI states.
- **Scope creep**: phase gates; anything beyond V1.1 requires Vision update.
- **Cost regression**: alarms on egress/requests; caching before scaling compute.
- **Browser/device variance**: test matrix for iOS/Android + major desktop.

---

## Guardrails for Contributors & Agents

- **Confirm necessity first**: Before any change, **prove** the issue exists and that fixing it advances this Vision. If uncertain, stop.
- **Respect policies & costs**: Keep to NWS policy; do not push changes that increase monthly cost beyond targets without approval.
- **Minimal blast radius**: Prefer small, reversible PRs; document in `AGENTUPDATEHISTORY.md` and `AGENTUPDATEHISTORY.jsonl` (include rationale, scope, test/rollback notes).
- **Catalog discipline**: New data sources require a catalog entry with provenance, update cadence, format, and policy notes.
- **No auth/user systems** unless explicitly added to Scope.

---

## Out of Scope (for V1/V1.1)

- Complex account systems, multi-tenant admin, heavy ML training pipelines, and large proprietary data contracts.
- Unlimited layer kitchen sink; everything must justify its runtime/UX cost.

---

## Change Log (high-level)

- Will be appended here per release; granular entries live in `AGENTUPDATEHISTORY.md` + `.jsonl`.

---

## Implementation Snapshot (Aug 2025)

Fully Implemented (Vision Alignment):

- Core map UI (React/MapLibre) with raster + vector layers from unified catalog.
- Credential shielding & policy compliance (NWS User-Agent, OWM key, FIRMS key) via proxy.
- Basic alerts persistence (DynamoDB + GeoJSON endpoint) and display.
- Timeline playback for time‑aware layers (foundation for satellite/radar loops).

Partial:

- Time-series intelligence (static current timestamp, dynamic enumeration pending).
- Infrastructure scalability: Terraform covers storage + table; compute scaling (proxy ECS/Lambda) pending.
- Observability: metrics endpoint present; alarm wiring pending.
- Model visualization: placeholders exist; tiling & ingest pipeline not active.

Not Yet Implemented (Future Vision Items):

- Nowcasting, advanced forecasting overlays, personalized notifications, user preferences.
- Multi-region failover & cost optimization strategies beyond baseline.
- Auth & subscription management.
