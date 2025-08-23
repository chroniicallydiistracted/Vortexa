## Mission & North Star
- Build an **all‑in‑one weather & earth‑science dashboard** for family use that is fast, reliable, and low‑cost (AWS‑first). (See `VISION.md`.)
- Clarity and speed of best‑in‑class map UIs, with disciplined data onboarding and budget control.

## Architecture (baseline)
- **Frontend:** React + Vite SPA.
- **Delivery:** S3 (private) behind CloudFront with **OAC**; ACM certificate in **us‑east‑1** for the custom domain `weather.westfam.media`.
- **Proxy:** Node/Express TypeScript; normalizes NASA GIBS WMTS and similar; optional S3 tile cache; CORS; allow‑list.
- **Alerts:** Lambda (Node 20) + EventBridge schedule; DynamoDB for alerts with **TTL**.
- **Infra:** Terraform manages S3, CloudFront, ACM, DynamoDB, Lambda, EventBridge, and Route 53 delegation.

## Domain & DNS
- **Authoritative:** Cloudflare for `westfam.media` (unchanged).
- **Delegation:** Route 53 hosted zone for `weather.westfam.media`; NS set in Cloudflare.
- **Records (delegated zone):** `A/AAAA` **alias** to CloudFront distribution; ACM validation CNAMEs from us‑east‑1 cert.

## Non‑Functional Requirements & Cost Targets
- **Reliability:** aim ≥ 99.5% monthly.
- **Latency:** p95 HTML at edge < 150 ms; p95 tile < 400 ms (normal upstream).
- **Cost:** typical ≤ $10/mo; burst ≤ $20/mo.
- **Security:** S3 **private** + Public Access Block; **OAC** is the only web bucket reader; least‑privilege IAM; no public write APIs.
- **Compliance:** NWS policy (custom User‑Agent with contact email) and vendor terms.

## Repo Landmarks (assumed present)
- `web/` — Vite React SPA; TanStack Query; map UI and panels; `.env.local` uses `VITE_TILE_BASE` for tiles.
- `services/proxy/` — TypeScript Express tile/edge proxy (dev on port 4000); WMTS normalization.
- `services/alerts/` — Node 20 Lambda; packaged as `dist-zip/alerts.zip`; handler `dist/index.handler`.
- `infra/terraform/` — Terraform for S3, CloudFront (OAC), ACM (us‑east‑1), DynamoDB, Lambda, EventBridge, Route 53.

## Non‑negotiable Guardrails
- Confirm necessity against `VISION.md` before any change. Quote the section you satisfy in PRs and history files.
- Prefer **small, reversible** diffs. Avoid repo‑wide refactors unless explicitly requested.
- **Cost discipline:** stay within the target band; prefer S3/CloudFront caching over long‑running compute.
- **IAM:** least privilege. Avoid wildcards on production paths.
- **S3:** keep Public Access Block on; web bucket is private; CloudFront **OAC** is the reader.
- **DNS/Certs:** treat Route 53, Cloudflare, ACM, and CloudFront viewer certificate changes as **sensitive** (approval required; log changes).
- **NWS policy:** alerts Lambda uses a custom **User‑Agent** header with contact email.

## Testing Expectations
- Add/update tests where applicable: unit for helpers; e2e/smoke for integration.
- Map features: verify pan/zoom/time slider performance.
- Proxy: assert URL normalization, correct upstream format (png/jpg), and cache headers.
- Alerts: assert NWS User‑Agent, dry‑run parse, DynamoDB write shape (`pk/sk/ttl`).
- Infra: rely on Terraform plan diffs and staged applies; do not apply destructive changes without approval.

## Commit / PR / History Conventions
- **Commit prefix:** `[frontend]` / `[proxy]` / `[alerts]` / `[infra]` / `[catalog]` / `[docs]` / `[tests]` / `[housekeeping]`; imperative subject, then one‑sentence rationale.
- **PRs include:** what changed & why (link to `VISION.md`), testing done (repro steps/screenshots), risk & rollback, cost impact, and checkboxes for README/env/history updates.
- **History files:** every change updates both `AGENTUPDATEHISTORY.md` (human summary) and `AGENTUPDATEHISTORY.jsonl` (machine log).

### AGENTUPDATEHISTORY.md (human‑readable) — required fields
- Date/time, short title, files touched, rationale, test steps, outcome, rollout/rollback notes.

### AGENTUPDATEHISTORY.jsonl (machine) — required fields
- `timestamp`, `paths[]`, `category`, `change_type`, `rationale`, `validation`, `cost_impact`, `relates_to_vision[]`, `pr_number|"none"`, `status`, `reviewers[]`.

## Data & Layer Onboarding Rules
- Each new source/layer documents: **provenance**, **license/policy**, **update cadence**, **format** (WMTS/XYZ/JSON), and an example request.
- Prefer routing via the **proxy** with a strict allow‑list. Do not bypass the proxy unless explicitly allowed.
- **GOES strategy:** default to one lightweight basemap; offer GOES‑East/West as toggles. If auto‑switching by viewport, include a clear user override.

## Explicit Approval Required (do not proceed without it)
- DNS changes (Cloudflare/Route 53), ACM/CloudFront viewer certificate changes, CloudFront distribution settings, S3 bucket replacements, IAM scope expansion, introduction of paid vendors or new regional footprints, or any change likely to increase cost materially.

## Default Posture
- Be conservative. Confirm necessity, keep changes small, test thoroughly, document precisely, and never jeopardize uptime, cost, or security.

## Operational Expectations
- CloudWatch logs with retention (≥ 14 days), minimal alarms (Lambda errors, 5xx bursts), health endpoints for the proxy.
- DynamoDB TTL for alerts; static deploys are immutable artifacts; rollbacks use object versioning.
- Runbooks for domain/cert/deploy and safe rollback (“panic button”).

## Source‑of‑Truth Pointers
- `VISION.md` — goals, success criteria, scope & phasing, guardrails, cost targets, and Definition of Done.
- `AGENTUPDATEHISTORY.md` — human changelog by category.
- `AGENTUPDATEHISTORY.jsonl` — machine‑readable log schema (append one JSON object per change).
- `README.md` (and per‑package READMEs) — setup and dev instructions; keep accurate.
- `.env.example` — authoritative list of environment variables; keep minimal and current (note any sensitive entries and where they live in AWS).

## Copilot Do / Don’t (enforcement cues for completions)
**Do:**
- Use least‑privilege IAM, private S3 with CloudFront OAC, and cost‑aware patterns.
- Keep diffs small; add tests; propose rollbacks; update both history files.
- Prefer proxy‑mediated data access with allow‑lists and cache headers.

**Don’t:**
- Suggest widening IAM to wildcards or exposing public write APIs.
- Add paid vendors or new regions without explicit approval and cost impact noted.
- Bypass the proxy for external tiles/data unless explicitly allowed.

---

### Definition of Done (production verification)
- Web/data S3 buckets **private** with Public Access Block; OAC configured.
- CloudFront serves `index.html`; ACM (us‑east‑1) validated; HTTPS on the custom domain.
- Delegated DNS resolves `weather.westfam.media` → CloudFront; cert CNAMEs present.
- Tile proxy live; **GOES‑East/West GeoColor** renders via WMTS through the proxy.
- Alerts Lambda scheduled; writes to DynamoDB; **TTL enabled**; no error alarms.
- Basic alarms and log retention (≥ 14 days) configured.
- README and `.env` examples match reality; NWS **User‑Agent** documented and set.
- Cost reviewed under real use and within budget.

---

> This document is intentionally factual and stable. Keep it synchronized with the source‑of‑truth files noted above. Update this file below this line when the architecture, guardrails, or conventions change.


