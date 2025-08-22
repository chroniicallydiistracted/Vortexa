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

## Deploy (AWS)
1. Ensure Terraform and AWS credentials (or OIDC from GitHub Actions).
2. `cd infra/terraform && terraform init && terraform apply`.
3. `npm run deploy` (builds web to S3, updates Lambda/ECR images).

See `docs/DEPLOY.md` for details.
