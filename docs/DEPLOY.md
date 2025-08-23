# Deploying to AWS (minimal path)

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

## 3) Run the tile proxy
Choose one:
- **Local** behind your firewall: `npm -w services/proxy run dev` (port 4000).
- **Lambda URL** (serverless): Package proxy as Lambda (Node20), attach to Function URL or API Gateway. (Module is ESM‑ready.)
- **ECS Fargate** (recommended for high TPS): Build the Dockerfile in `services/proxy`, push to ECR, run behind an ALB; set CORS on ALB.

> Infra for API Gateway/ECS is not included in the minimal Terraform. Add these when you pick a path.

## 4) Catalog / ingest
- `data/catalog.json` is generated from your CSVs; Lambdas read it via env (`CATALOG`).
- For heavy ingest, wire `services/ingest` to a Step Functions state machine with EventBridge schedules per feed.
