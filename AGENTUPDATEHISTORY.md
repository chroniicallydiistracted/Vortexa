# AGENTUPDATEHISTORY

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
