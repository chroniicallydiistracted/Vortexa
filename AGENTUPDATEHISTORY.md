# AGENTUPDATEHISTORY

### 2025-08-23: Version 0.2.0 Release – 3D Globe V3 (Playback, FIRMS & OWM Overlays) & GIBS Generalization

Version: 0.2.0

Scope:
- Introduces temporal playback for GIBS GeoColor (timestamps endpoint, UI controls, store state, interval-driven animation).
- Adds FIRMS fire detections (point primitives) and OWM temperature raster overlay toggles to 3D globe.
- Generalizes GIBS capabilities parsing with extensible utility + tests (`fetchCapabilities`).
- Expands test suite to 22 passing cases (including GeoColor tiles, timestamps, capabilities parsing, CartoDB basemap).

Rationale:
- Elevate 3D experimental globe toward multi-layer situational awareness while retaining opt-in nature; establish foundation for additional GIBS layers and environmental overlays.

Quality & Validation:
- All proxy/service tests green (22/22) prior to tag.
- Full monorepo build successful (web bundle produced; Cesium chunk isolated). No type errors.

Risks / Considerations:
- Heuristic XML parsing may be brittle for future GIBS schema changes (follow-up to adopt robust parser).
- Additional 3D overlays may impact performance on low-spec devices (monitor FPS; consider point thinning & imagery layer culling heuristics).

Follow Ups (Not in 0.2.0):
- Replace regex parsing with streaming or DOM XML parser.
- Add legends (temperature color scale) & dynamic FIRMS symbology based on confidence/brightness.
- Introduce periodic refresh cadence & caching for FIRMS/OWM to reduce toggle fetch spikes.
- Multi-layer GIBS selection UI (beyond GeoColor) leveraging generalized capabilities.
- E2E/UI tests for playback controls & overlay toggles.

Tag Intent:
- Marks completion of Globe V3 milestone; semantic MINOR bump due to additive features without breaking API surface.


### 2025-08-23: GIBS Proxy Test Suite

Summary:
- Added dedicated Vitest suite for `/api/gibs/geocolor/:z/:x/:y.:ext` validating happy path (status, headers, cache-control), upstream URL composition (host, time encoding, coordinate ordering), invalid coordinate handling, and upstream error pass-through.

Motivation: Increase regression protection for new dynamic earth observation imagery proxy ensuring correctness before adding more GIBS layers/time logic.

Risk: Low (tests only). No runtime code changes.

Follow Ups: Expand tests to cover additional GIBS layer variants & future time enumeration endpoint once implemented.

Note: Minor refactor to `gibs.ts` adding injectable fetch (`global.__TEST_FETCH__`) for deterministic test mocking without impacting production code paths.

### 2025-08-23: GIBS Dynamic Time Handling (3D Globe)
### 2025-08-23: 3D Globe V3 – Time Playback, FIRMS & OWM Layers, Generalized GIBS

Summary:
- Added playback controls (play/pause, step, speed) for GIBS timestamps in Panel; auto-advances selected time.
- Generalized GIBS capabilities parsing (`fetchCapabilities`) with layer param and utility tests.
- Added FIRMS fire detections overlay (PointPrimitiveCollection) in 3D globe, toggle in Panel.
- Added OWM temperature raster overlay via proxy tile template, toggle in Panel.
- Store extended with playback state, speed, and new 3D layer toggles.

Motivation: Incrementally evolve 3D globe toward parity with 2D for core situational layers while retaining gated experimental posture.

Risk: Low–moderate; additive overlays may affect 3D performance on low-end devices (monitor for frame drops). Heuristic XML parsing still used.

Follow Ups: Debounce FIRMS reload cadence, color scale legend for OWM temps, switch to streaming XML parser if capabilities size grows, add memory cleanup on rapid toggles.

Summary:
- Added `/api/gibs/timestamps` endpoint parsing WMTS capabilities to return sorted ISO timestamps.
- Extended store with `gibsTimestamps` & `gibsSelectedTime` plus setters.
- Panel now fetches timestamps when 3D + GeoColor active and provides a dropdown; initializes selection to latest.
- Cesium globe updates GeoColor imagery layer on timestamp change (layer recreate with new time param templated).
- Added Vitest suite `gibsTimestamps.test.ts` covering parsing, error handling, empty-layer case.
- Roadmap updated marking dynamic time dimension done (for GeoColor baseline).

Motivation: Enable temporal exploration of GOES-East GeoColor imagery in optional 3D mode while retaining 2D primacy and proxy-first policy.

Risk: Low; additions isolated behind 3D + layer toggle. XML parsing heuristic may need hardening if schema shifts.

Follow Ups: Generalize timestamp retrieval for additional GIBS layers, add UI playback for time stepping, refactor XML parsing to streaming or schema-driven approach.

### 2025-08-23: CartoDB Positron Basemap via Proxy (2D + 3D)
-
### 2025-08-23: 3D Globe V2 – Attribution, CartoDB Test, GIBS GeoColor Toggle

Summary:
- Added attribution credit on 3D globe (Cesium) for CartoDB / OSM.
- Added automated Vitest for `/api/cartodb` validating headers & status.
- Introduced GIBS GeoColor imagery toggle (proxy-backed) in 3D mode with feature gating intact.
- Extended store with `gibsGeocolor3d` flag and UI checkbox when 3D active.

Motivation: Improve compliance (attribution), test coverage for new basemap route, and begin layering dynamic earth observation imagery in optional 3D context without impacting 2D primary UX.

Risk: Low; additive toggle & route. Fallbacks retain previous behavior if env not set.

Follow Ups: Add time parameter wiring for GIBS, add removal tests, performance measure of extra imagery provider.


Summary:
- Added `/api/cartodb/positron/:z/:x/:y.png` proxy route with subdomain rotation (a–d), custom User-Agent, and 24h immutable caching headers.
- Integrated basemap into MapLibre (2D) by replacing external demo style with internal raster source using env `VITE_BASEMAP_TILE_URL`.
- Integrated basemap into Cesium (3D) using `UrlTemplateImageryProvider` with same env template for consistency.
- Updated allow-list to include `basemaps.cartocdn.com` and added `.env.example` variable.

Motivation:
- Provide neutral, performant, no-cost foundational basemap uniformly across 2D and 3D; eliminate dependency on demo style endpoint; unify visual context for future overlays.

Risk / Impact:
- Low (additive). New route and env variable; fallback defaults ensure existing behavior remains if unset.

Validation:
- Local manual verification: 2D map loads Positron tiles through proxy; 3D globe imagery layer replaced with Positron proxy tiles.
- Build passes; existing tests unaffected (follow-up test for CartoDB route planned).

Rollback:
- Remove route file, delete env var lines, revert Map/Cesium components to prior sources.

Follow Ups:
- Add automated Vitest for `/api/cartodb` (mock axios) ensuring headers & cache-control.
- Surface attribution panel (Carto, OpenStreetMap contributors).
- Consider dark theme variant toggle.

DX + Infra polish (web/proxy/lambda/terraform) – Summary of Applied Changes

Date: 2025-08-22
Branch (to be created): `dx-infra-polish`

## 1. Root Monorepo Scripts & Engines
- Added `engines` field `{ "node": ">=20 <21" }` to root `package.json`.
  Reason: Enforce consistent runtime (Node 20) across all workspaces for deterministic builds and Lambda baseline.
- Reworked scripts:
  - `dev:proxy`: delegates to proxy workspace dev (tsx watch) for clarity.
  - `dev:web`: delegates to web workspace dev (Vite) for clarity.
  - `dev`: now composes the two above (cleaner than inlining workspace invocations) using existing `concurrently` dependency.
  - `build`: sequentially builds `services/shared`, `services/proxy`, `services/alerts`, then `web` (previously only built `web`). Ensures shared types emitted before dependent builds and that all deployable artifacts are compiled in CI.
  - `package:alerts`: invokes existing `scripts/package-alerts.sh` to produce reproducible Lambda zip (dist + dependencies). Centralizes packaging behind npm scripts for CI.
  Reason: Improve DX, deterministic multi-package build ordering, and add a single entrypoint for Lambda packaging.

## 2. Workspace Engines
- Added `"engines": { "node": ">=20 <21" }` to:
  - `services/proxy/package.json`
  - `services/alerts/package.json`
  - `services/shared/package.json`
  - `web/package.json`
  Reason: Consistent Node runtime expectation; avoids inadvertent use of earlier/later Node versions with differing fetch or ESM semantics.

## 3. Proxy Service Enhancements (`services/proxy/src/index.ts`)
Changes:
- Added imports for `fs` & `path` to read local `package.json` for version reporting.
- Normalized `ALLOW_HOSTS` parsing: trims & filters empty entries to prevent false positives.
- Added startup cache logging: logs either `cache: disabled` (no S3 bucket) or `cache: s3://<bucket>`.
- Added dynamic package version extraction (defaults to `0.0.0` if read fails).
- Added `/healthz` endpoint returning `{ status: "ok", upstreams: [...], time: <ISO> }` for readiness/liveness probes (distinct from existing `/health`).
- Added `/version` endpoint exposing `{ version }` (no secrets) for deployment traceability.
- Strengthened host allow logic: now logs structured warning on rejected host or invalid URL; explicit 400 error differentiation (`missing url` vs `blocked host`).
- Added explicit TypeScript types to middleware & route handlers (eliminates implicit `any`).
Reason: Production observability (health/version), clearer rejection diagnostics, safer configuration parsing, improved DX with explicit types, and traceability for deployments.

## 4. Web App Banner (`web/src/ui/App.tsx`)
Changes:
- Introduced a top banner (dismissible) when `VITE_TILE_BASE` env is absent, informing user fallback `http://localhost:4000/tiles` is in effect.
- Adjusted layout grid to reserve space only when banner showing.
Reason: Hardening UX—surfacing misconfiguration early rather than silent fallback; reduces confusion in deployed/staging environments.

## 5. Terraform CloudFront Domain Flexibility (`infra/terraform/main.tf`)
Changes:
- Added variable `acm_certificate_arn` (default "").
- Reworked `viewer_certificate` blocks to support three paths:
  1. No `domain_name` -> default CloudFront certificate.
  2. `domain_name` set + `acm_certificate_arn` set -> attach provided cert (must be in us-east-1).
  3. (Commented guidance) External certificate provisioning handled outside current module; avoids enforcing Route53 management here.
- Added `aliases = var.domain_name == "" ? [] : [var.domain_name]` (already present; documented rationale in comments).
- Added `lifecycle { ignore_changes = [viewer_certificate] }` to prevent unnecessary diffs if AWS mutates internal certificate state (optional stabilization).
Reason: Allow optional custom domain without forcing in-repo ACM issuance/validation; preserve existing default-cert behavior; make path to custom domain explicit and non-breaking.

Note: Removed explicit dependency on an internal cert validation resource (not defined in this file) to avoid referencing undeclared resources when no custom domain used.

## 6. No Changes Applied To (Documented Non-Actions)
- Alerts Lambda source (`services/alerts/src/index.ts`): left unchanged (already minimal and functional for DynamoDB ingestion). Future improvement could add structured logging or batching.
- `scripts/package-alerts.sh`: retained (now used by `package:alerts` script); deterministic packaging flagging <1 KB validation not yet added—can be an enhancement step.
- Map layer logic (`MapView.tsx`): left as-is aside from unaffected imports; redundancies (noop replaceAll) deferred intentionally to keep PR focused.

## 7. Follow-up Suggestions (Not Implemented Here)
- Add size verification & hash output inside `scripts/package-alerts.sh` (ensure non-empty & reproducible artifact).
- Introduce lightweight OpenAPI / metrics for proxy (e.g., `/metrics` Prometheus endpoint).
- Add GitHub Actions workflow: build + lint + package alerts + terraform plan.
- Add React ErrorBoundary & offline detection for web app.
- Replace manual source reading for version with bundler plugin injecting version constant (reduces fs read at runtime).

## 8. Compatibility / Risk Assessment
- Terraform: New optional variable is backward compatible; default behavior identical when `domain_name == ""`.
- Proxy: New endpoints additive; existing `/health` unchanged. Logging additions do not alter response semantics.
- Web: Banner only appears when env missing; dismiss state is local component state (stateless across reloads) – acceptable for dev.
- Build script order ensures shared types compiled before dependents; potential slight build time increase accepted for correctness.

## 9. Validation Status
(BUILD NOT YET EXECUTED in this log – should run after commit in CI or locally.)
- TypeScript compile expected to pass (explicit types added).
- Need to run: `npm run build` and `npm run package:alerts` after merge to confirm packaging.

---
Prepared by automated assistant per user request before PR creation.

## Structured Change Log Entries (Appended)

### 2025-08-22: Terraform Domain Validation & Deterministic Alerts Packaging
Change IDs: (see JSONL for canonical IDs)

Summary:
- Added Terraform variable validation blocks ensuring `domain_name` and `acm_certificate_arn` are either BOTH set or BOTH empty; enforced us-east-1 ARN pattern for ACM.
- Rewrote `scripts/package-alerts.sh` for deterministic Lambda artifact creation (uses `npm ci`, prunes dev deps, sorted file list, stable zip with checksum output).

Motivation / Rationale:
- Prevent partial custom domain configuration that would yield a misconfigured CloudFront distribution or unintended default cert usage.
- Ensure reproducible, minimal Lambda deployment package (smaller size, integrity hash for promotion or attestation, supports future CI caching and SBOM).

Scope of Impact:
- Infra safety: earlier surfacing of configuration mistakes during `terraform validate`.
- Deployment pipeline: packaging script now produces `alerts.zip` plus `alerts.zip.sha256` for integrity checks.

Risk Assessment:
- Low: Validation only rejects invalid combos that would not have behaved as intended; packaging script deterministic but preserves output location.

Next Steps / Follow Ups:
- Integrate GitHub Actions workflow to invoke packaging + record checksum artifact.
- Add size and hash verification step in deploy script before upload.
- Consider SBOM generation (e.g., `cyclonedx-npm`) post-prune for supply chain tracking.

Verification (manual):
- Terraform file syntactically valid (no apply executed yet pending human approval).
- Packaging script run locally to confirm non-empty zip & checksum (CI automation to be added).

Vision Alignment:
- Reliability & Operational Safety (Goal 2): early detection of misconfiguration.
- Scalable Infrastructure (Goal 6): reproducible artifacts for consistent promotion environments.

---

### 2025-08-22: Accessible HTML Shell & PWA Scaffolding (`web/index.html`)

Summary:
- Expanded `web/index.html` into a richer, accessible UI shell: added language + theme attributes, meta tags (`description`, `theme-color`, `color-scheme`), icon & manifest links, structural landmarks (banner header, toolbar as dock, timeline controls), skip link, screen reader live region, semantic roles, and baseline styling (glass panels, responsive adjustments). Included minimal JS for demo interactivity (aria-pressed toggle) without coupling to React app logic.

Rationale:
- Establish accessible, performance-minded foundation (landmarks, skip navigation, aria attributes) and prepare for future PWA (manifest, icons). Reduces future diff size by centralizing layout scaffolding early.

Files Touched:
- `web/index.html` (major modify)

Testing / Validation:
- Manual load via Vite dev: verified rendering, skip link focus behavior, aria-pressed toggling, no console errors.

Risk:
- Low (static HTML only). No runtime code paths altered; React mount point unchanged (app mounts into map container / root script tag still present).

Rollback:
- Revert file to prior minimal HTML; no state migrations required.

Follow Ups:
- Add Lighthouse baseline (perf/a11y) and track improvements.
- Implement dynamic timestamps & playback logic inside React layer.

Vision Alignment:
- High-Performance Visualization (Goal 2): groundwork for responsive performant UI.
- Personalization & Accessibility (Goal 5): initial a11y affordances.

---

### 2025-08-22: History Schema Migration v1.0 -> v2.0 & Governance Docs

Summary:
- Upgraded `AGENTUPDATEHISTORY.jsonl` schema to v2.0 adding: `category`, `change_type`, `cost_impact`, `reviewers[]`, `relates_to_vision[]`, `paths[]`, `validation[]`. Backfilled prior entries with new fields (defaulting `cost_impact: none`, empty reviewers). Added governance collateral: PR template, commit conventions, and operational runbook. Logged migration entry in JSONL.

Rationale:
- Improve traceability, enforce explicit vision alignment tagging, capture cost/risk context, and standardize contribution workflow to reduce ambiguity and future audit friction.

Files Touched:
- `AGENTUPDATEHISTORY.jsonl` (schema line + backfilled entries + new migration entry)
- `.github/pull_request_template.md` (new)
- `docs/COMMIT_CONVENTIONS.md` (new)
- `docs/RUNBOOK.md` (new)

Testing / Validation:
- Manual inspection of JSONL for syntactic correctness; ensured each existing entry now surfaces required v2.0 fields.

Risk:
- Low: additive metadata; no runtime code depends on schema yet.

Rollback:
- Restore previous JSONL from git history and remove added docs (would lose enhanced metadata).

Follow Ups:
- Add CI step to validate JSONL entries against schema.
- Populate `reviewers[]` when human approvals occur.

Vision Alignment:
- Scalable Infrastructure / Operational Excellence (Goal 6): better governance & auditability.
- Personalization & Accessibility (Goal 5): indirectly via process rigor enabling safe a11y improvements.

---
