# Deploying to AWS (Current State)

## Prereqs
- AWS account + credentials (or GitHub OIDC)
- Terraform >= 1.5
- Node 20+

## 1) Provision core infra
```bash
cd infra/terraform
terraform init
terraform apply -var='region=us-west-2' \
  -var='name=westfam' \
  -var='web_bucket=westfam-web-<unique-suffix>' \
  -var='data_bucket=westfam-data-<unique-suffix>' \
  -var='alerts_zip=../../services/alerts/dist-zip/alerts.zip'
```
> Create `alerts.zip` via: `./scripts/package-alerts.sh`

## 2) Publish web
```bash
export WEB_BUCKET=westfam-web-<unique-suffix>
# Suffix guidance: choose a short globally-unique token (e.g., initials + date) to avoid S3 name collisions.
./scripts/deploy.sh
```
CloudFront domain is printed as `cdn_domain` output.

## 3) Run the tile / data proxy
Current implemented path:
* **Local (dev / staging)**: `npm -w services/proxy run dev` (port 4000) with env secrets for FIRMS/OWM/NWS.

Planned production deployment options (not yet provisioned in Terraform):
* **Lambda URL / API Gateway**: Package proxy (Node 20) as Lambda for bursty, lower sustained TPS.
* **ECS Fargate** (recommended future): Containerized always‑on proxy with autoscaling & S3 cache bucket.

Secrets (set in runtime environment / Actions secrets): `FIRMS_MAP_KEY`, `OWM_API_KEY`, `NWS_USER_AGENT`.

## 4) Catalog / ingest
* Active catalog file: `web/public/catalog.json` (manually maintained enriched schema).
* Ingest / model tiling (GFS/HRRR) not yet implemented—placeholders remain for future integration.

---

## Implementation Status (Deploy Surface)

### Fully Implemented
* Terraform: core scaffolding (buckets, DynamoDB table, baseline validation) – adjust variables as needed.
* Web build & deploy script (`scripts/deploy.sh`) producing static site suitable for S3 + CloudFront.

### Partially Implemented
* Proxy deployment: only local dev path; infrastructure modules for Lambda/ECS not present.
* Secrets handling: GitHub Actions workflow exports secrets to tests; production deploy injection pattern to be finalized (e.g., task definition env vars or Lambda configuration block).
* Alerts Lambda packaging: build + zip packaging integrated; deployment wiring for scheduled EventBridge rule not included yet in Terraform docs.

### Not Yet Implemented
* Automated provisioning for proxy (API Gateway / ECS / Lambda URL) including IAM, logging, scaling policies.
* S3 cache bucket & IAM policy attachment for proxy tile caching.
* Step Functions / EventBridge driven ingest for external feeds (radar archives, model GRIB processing).
* Distribution invalidation automation post deploy (add CloudFront invalidation step in script or Terraform output integration).

---

## Next Steps (Suggested)
1. Add Terraform module for proxy deployment (choose Lambda for simplicity or ECS for sustained load); pass in secrets via SSM Parameter Store or Secrets Manager.
2. Introduce CloudFront distribution behavior/path for proxy (if centralizing under same domain) or custom subdomain (e.g., api.weather.westfam.media).
3. Implement ingest job(s) for time‑indexed model tiles and dynamic timestamp enumeration for radar/satellite loops (reduce client guessing of current frame).
4. Add minimal alarms (5xx rate, DynamoDB throttles) and retention policies.

