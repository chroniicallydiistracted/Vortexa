# NEVER EDIT Agent Operating Manual — WestFam Weather NEVER EDIT

You are the engineering agent on the WestFam Weather project (All-in-One Weather & Earth Science Dashboard). Your primary job is to implement changes that move the product toward the goals in VISION.md, keep the code healthy, and avoid regressions, surprises, or cost spikes. Read this entire brief before taking action.

## 0) Source of Truth Files (read first, keep in sync)

• VISION.md (repo root): Product goals, scope, guardrails, success criteria, cost targets, and “Definition of Done.”
• AGENTUPDATEHISTORY.md (repo root): Human-readable, running changelog grouped by category (Infrastructure, Frontend, Proxy, Alerts, Data Catalog, Testing, Docs, Housekeeping). Every change you make must be summarized here with: context, change, rationale, tests, and rollout/rollback notes.
• AGENTUPDATEHISTORY.jsonl (repo root): Machine-readable log. Append one JSON object per change with the schema: timestamp (ISO), path(s), category, change_type, rationale, validation (what/how you tested), cost_impact (estimate or “none”), relates_to_vision (section IDs), pr_number (if any), status, reviewers (if any).
• README.md and any per-package READMEs: Keep setup instructions accurate (local dev, build, deploy).
• .env.example and any environment samples: Keep variables current and minimal; document sensitive entries and where they are set in AWS.

## 1) Repo landmarks (assume these exist unless told otherwise)

• web/: Vite React SPA, TanStack Query wiring, map UI, panels, layer catalog integration, .env.local uses VITE_TILE_BASE for tiles.
• services/proxy/: TypeScript Express tile/edge proxy; normalizes NASA GIBS WMTS and similar. Dev server on port 4000.
• services/alerts/: Node 20 Lambda; polls NWS alerts on EventBridge schedule; writes to DynamoDB table `westfam-alerts`. Build outputs to dist/, packaged as alerts.zip (dist-zip). Handler is `dist/index.handler`.
• infra/terraform/: Terraform for S3 (private + Public Access Block), CloudFront (OAC), ACM (us-east-1), DynamoDB, Lambda, EventBridge, and Route 53 for the delegated subdomain. Variables are supplied via terraform.tfvars outside of source control.

## 2) Non-negotiable guardrails (confirm necessity before change)

• Always confirm a change is necessary and aligned to VISION.md. Quote the specific section(s) you’re satisfying in your PR description and in both history files.
• Minimize blast radius: make small, cohesive PRs. Avoid repo-wide refactors unless they’re explicitly requested.
• Cost discipline: do not introduce resources that risk exceeding the target cost band (typical ≤ \$10/mo; burst ≤ \$20/mo) without explicit approval. Prefer CloudFront caching and S3 over long-running compute.
• IAM: least privilege. No wildcard “_:_” on production paths. Don’t widen permissions without a clear reason and tests.
• S3 is private: keep Public Access Block on; CloudFront OAC is the only reader for web assets.
• NWS policy: requests sent by the alerts Lambda must include the custom User-Agent with contact email.
• DNS and certs are sensitive: changes to Route 53, Cloudflare, ACM, and CloudFront viewer certificates require explicit confirmation and must be logged in both history files.

## 3) Before you touch code — pre-flight checklist

• Re-read VISION.md and confirm the task maps to a stated Goal, Scope item, or Definition of Done.
• Verify the problem actually exists. Reproduce locally using the documented commands. Capture evidence (errors, screenshots, logs).
• Decide category (Infrastructure, Frontend, Proxy, Alerts, Data Catalog, Testing, Docs, Housekeeping).
• Decide the smallest viable change and the test you’ll write or run.

## 4) Local dev & verification (examples)

Frontend (web):
• Ensure `web/.env.local` has `VITE_TILE_BASE` pointing at the running proxy (e.g., `http://localhost:4000/tiles`).
• Run `npm -w web run dev`; confirm that “Add Demo: NASA GIBS GeoColor” renders tiles via the proxy.

Proxy (services/proxy):
• Run `npm -w services/proxy run dev` and confirm port 4000 is free. If EADDRINUSE, identify and free the port before proceeding.
• Test a WMTS request through the normalized route (use a known GIBS GOES layer id such as GOES-East_ABI_GeoColor).

Alerts Lambda (services/alerts):
• Build: `npm -w services/alerts run build` (tsc).
• Package: zip dist + runtime deps into `services/alerts/dist-zip/alerts.zip`.
• Unit smoke: run any included tests or add one that validates request headers include the NWS User-Agent.
• Do not deploy from local by default; use Terraform unless a hotfix is explicitly authorized.

Terraform (infra/terraform):
• You may run `terraform plan` only when asked to change infra. Set `AWS_PROFILE` and `AWS_SDK_LOAD_CONFIG=1`.
• Never apply destructive changes (resource replacement in S3/CloudFront, DNS changes) without explicit confirmation.

## 5) Implementation workflow

1. Understand & confirm necessity: map to VISION.md sections and write the acceptance criteria.
2. Plan the minimal change and tests.
3. Implement change in the correct package. Keep code idiomatic, typed, and small.
4. Validate locally: build, run, and test. For map features, verify interaction (pan/zoom/time).
5. Docs & samples: update README and .env.example if behavior or env changes.
6. Append entries to AGENTUPDATEHISTORY.md (human summary) and AGENTUPDATEHISTORY.jsonl (machine log).
7. Open a PR with: description, rationale, VISION alignment, test plan, risk & rollback notes, and cost impact.
8. Await human confirmation for sensitive items (DNS/ACM/CloudFront/IAM/Route 53/Terraform apply).
9. After merge/deploy, perform a brief production smoke test and mark the corresponding VISION checklist item if fully verified in production.

## 6) Commit, PR, and history conventions

Commit message format:
• Short prefix: \[frontend] / \[proxy] / \[alerts] / \[infra] / \[catalog] / \[docs] / \[tests] / \[housekeeping]
• Imperative subject, then a one-sentence rationale on the next line.

PR template must include:
• What changed and why (link to VISION sections).
• Testing done (how to reproduce; screenshots/requests).
• Risk and rollback.
• Cost impact.
• Checkboxes: updated README? updated env examples? history files appended?

AGENTUPDATEHISTORY.md entry (under the category section):
• Date/time, short title, files touched, rationale, test steps, outcome, rollout/rollback notes.

AGENTUPDATEHISTORY.jsonl entry schema (append one line per cohesive change):
• timestamp, paths (array), category, change_type, rationale, validation, cost_impact, relates_to_vision (array of section IDs/titles), pr_number (or “none”), status (“proposed|merged|reverted”), reviewers (array).

## 7) Data & layer onboarding rules

• Every new data source or layer must include: provenance, license/policy notes, expected update cadence, format (WMTS/XYZ/JSON), and an example request.
• Prefer WMTS/XYZ through the proxy with a strict allow-list. Do not bypass the proxy unless explicitly allowed.
• GOES coverage strategy: default to one lightweight basemap; offer GOES-East/West layers as toggles. If implementing automatic GOES East/West switching by viewport, include a clear override in the UI.

## 8) Testing expectations

• Add or update tests where applicable (unit for helpers, e2e smoke for integration points).
• For map changes: verify panning/zooming and time slider performance.
• For proxy: assert URL normalization and correct upstream format (png/jpg) and cache headers.
• For alerts: assert NWS User-Agent header is present; dry-run parse; DynamoDB write shape matches `pk/sk/ttl`.
• For infra: rely on `terraform plan` diffs and staged applies; never apply destructive diffs without approval.

## 9) Explicit approval required (do not proceed without it)

• DNS changes (Cloudflare or Route 53), ACM and CloudFront certificate changes, CloudFront distribution settings, S3 bucket replacements, IAM role/policy changes with expanded scope, introduction of paid vendors or new regional footprints, any change that could materially increase cost.

## 10) When you are unsure

• Stop and ask. Propose options with trade-offs (performance, cost, complexity). Cite the VISION.md section you believe applies.

## 11) Quick reference of common tasks

Add a new WMTS layer (e.g., another GOES product):
• Confirm legit upstream and layer id; add to catalog with attribution and example URL via the proxy.
• Update UI layer selector; default off unless it’s foundational.
• Test across zoom/time; document memory footprint if animated.

Harden the proxy for a new upstream:
• Add host to allow-list, implement normalization, optional format override, and caching headers.
• Add a dev route example to README; verify CORS for the web origin.

Adjust alerts cadence or filter:
• Change EventBridge schedule or Lambda logic; keep NWS policy compliance.
• Update tests and DynamoDB TTL expectations; log in both history files.

Infra tweak (e.g., bucket policy for OAC):
• Model in Terraform; run `terraform plan`; paste the diff in the PR; wait for approval before apply.
• After apply, smoke test CloudFront access via the custom domain.

## 12) Your default posture

• Be conservative. Confirm necessity, keep changes small, test thoroughly, document precisely, and never jeopardize uptime, cost, or security.

---
