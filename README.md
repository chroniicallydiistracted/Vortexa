# WestFam Weather — AWS‑ready Foundation

This repository is a **starter monorepo** for your all‑in‑one weather & earth science dashboard.
It wires up an AWS‑first backend (API Gateway + Lambda + EventBridge + DynamoDB + S3 + CloudFront)
and a performant MapLibre‑powered web app, plus a high‑throughput **tile proxy** that can run
either **serverless** (Lambda URL) or **containerized** (ECS Fargate).

> Data sources are declared in `data/catalog.json` (auto‑generated from your CSVs on 2025-08-21).

## High‑level architecture
- **Web (React/Vite/TS + MapLibre)**: PWA, layer registry, timeline animator, Windy‑style particles (hook stub).
- **Edge/Tile Proxy (Node/Express/TS)**: WMS/WMTS/TMS proxy with S3 + CloudFront caching and strict upstream allow‑list.

## Quickstart (local dev)

1) Install deps and build shared types
	- From repo root: `npm i`
	- Build shared: `npm -w services/shared run build`
2) Start dev services
	- Proxy: `npm -w services/proxy run dev` (listens on 4000)
	- Web: `npm -w web run dev` (serves on 5173)
3) Configure tiles base
	- Copy `web/.env.example` to `web/.env.local` (adjust if proxy URL differs)
4) Open the app and add the demo GeoColor layer from the side panel.

Notes:
- NWS endpoints recommend a custom User-Agent. Set `NWS_USER_AGENT` in Alerts Lambda env.
- Proxy upstream allow-list defaults to: `gibs.earthdata.nasa.gov, opengeo.ncep.noaa.gov, nomads.ncep.noaa.gov`.
- **Ingest (AWS Lambda / Python)**: Scheduled pulls of radar, satellite, models into S3 (lake) + metadata in DynamoDB.
- **Alerts (AWS Lambda / Node)**: Polls/streams NWS CAP alerts → DynamoDB → SNS/WebPush.
- **Infra (Terraform)**: One‑command provisioning (buckets, CF dist, API, lambdas, tables, schedules).

## Quick start (local dev)
```bash
# Node 20+ recommended
npm -v && node -v

# Install workspaces
npm i

# Start proxy + web
npm run dev
```

### Local DynamoDB + Alerts Data

We ship a lightweight local workflow for features that depend on DynamoDB (e.g. `/api/alerts`).

1. Start local DynamoDB (in one terminal):
```bash
docker compose up dynamodb-local
```
2. (Optional) Seed a table for the alerts overlay:
```bash
aws dynamodb create-table \
	--table-name westfam-alerts \
	--attribute-definitions AttributeName=pk,AttributeType=S \
	--key-schema AttributeName=pk,KeyType=HASH \
	--billing-mode PAY_PER_REQUEST \
	--endpoint-url http://localhost:8000

aws dynamodb put-item \
	--table-name westfam-alerts \
	--item '{"pk":{"S":"alert#demo"},"data":{"M":{"id":{"S":"demo"},"event":{"S":"Test Warning"},"headline":{"S":"Local Dev Test"},"severity":{"S":"Moderate"},"geometry":{"M":{"type":{"S":"Polygon"},"coordinates":{"L":[{"L":[{"L":[{"N":"-113"},{"N":"33"}]},{"L":[{"N":"-111"},{"N":"33"}]},{"L":[{"N":"-111"},{"N":"34"}]},{"L":[{"N":"-113"},{"N":"34"}]},{"L":[{"N":"-113"},{"N":"33"}]}]}}]}}}}}' \
	--endpoint-url http://localhost:8000
```
3. Run the dev stack (web + proxy) with the root helper script (adds concurrency):
```bash
npm run dev
```
4. Visit the app; the alert polygon should render (if seeded) as a red overlay.

The proxy now auto-detects local mode (`NODE_ENV=development`) and points the DynamoDB client to `http://localhost:8000` (override via `DYNAMODB_ENDPOINT`).

### SAM Template (Local Lambda Image Build Stub)
`alerts-lambda/template.yaml` is a minimal AWS SAM template placeholder for packaging an image-based Alerts function. Extend it with events & permissions when you implement the real ingestion / alert normalization logic.

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
- Root `.env` (see `.env.example`) for shared deploy & packaging vars: `WEB_BUCKET`, `DATA_BUCKET`, `PROXY_CACHE_BUCKET`, `NWS_USER_AGENT`.
- Web `web/.env.local` from `web/.env.example` sets `VITE_TILE_BASE` (defaults to local proxy if unset).
- Terraform variables set in `infra/terraform/terraform.tfvars` (or via environment) for bucket names, region, domain.

## Deploy (AWS)
1. Ensure Terraform and AWS credentials (or OIDC from GitHub Actions).
2. `cd infra/terraform && terraform init && terraform apply`.
3. `npm run deploy` (builds web to S3, updates Lambda/ECR images).

See `docs/DEPLOY.md` for details.
