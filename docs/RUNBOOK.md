# Runbook

Operational guide for WestFam Weather.

## 1. Environments

- dev: local + on-demand AWS (manual apply)
- prod: future (not yet provisioned)

## 2. Deploy Web & Proxy

1. Ensure tests pass: npm test
2. Package alerts (checksum reused): ./scripts/package-alerts.sh
3. Deploy: ./scripts/deploy.sh
4. Verify:
   - Web loads via CloudFront domain
   - /version endpoint returns current package version
   - /healthz returns ok

## 3. Terraform Changes

1. terraform -chdir=infra/terraform fmt & validate (CI enforces)
2. terraform plan (capture output)
3. Human approval required for medium/high risk
4. terraform apply
5. Record entry in AGENTUPDATEHISTORY.jsonl (schema v2.0)

## 4. Rollback

Web:

- Re-deploy previous artifact (locally keep last 2 zips with checksum)
  Infra:
- Use terraform apply with prior state (if drift) or revert commit and re-apply

## 5. Lambda Alerts Integrity

Artifact packaged deterministically. Before deploy script sync:

- Script re-computes SHA256
- Compare against stored checksum file
  If mismatch: abort deploy and investigate dependency or build env changes.

## 6. DNS & Certificates

- Add domain + certificate ARN together (validation enforces pairing)
- ACM cert must be in us-east-1 for CloudFront
- Post-provision: create Route53 A/AAAA alias to distribution

## 7. Monitoring & Health

Endpoints:

- /health (basic)
- /healthz (deep) – extend with upstream pings in future
- /metrics (Prometheus style) – counters: proxy_requests, proxy_cache_hits, proxy_cache_misses, wmts_redirects, process_uptime_seconds
  Example:
  ```
  curl -s https://<proxy-host>/metrics | grep proxy_requests
  proxy_requests 42
  ```

## 8. Access Patterns / Caching

- Tile proxy may cache responses in S3 (if configured)
- Confirm cache hits via logs (hit / miss strings)

## 9. Troubleshooting

| Symptom           | Check                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| 403 on web assets | CloudFront OAC policy / bucket public access block                    |
| Tiles slow        | Upstream latency, add caching, inspect allowHosts                     |
| Alerts empty      | Verify EventBridge schedule and DynamoDB TTL not prematurely expiring |

## 10. Cost Awareness

- S3: low baseline (private bucket + CloudFront transfer dominates)
- CloudFront: driven by traffic volume & tile size
- DynamoDB: on-demand recommended; watch for hot partition on alerts

## 11. Future Enhancements (Planned)

- Latency histogram & upstream status metrics (added; expand with percentiles dashboard)
- Nightly terraform drift detection (added; extend with notifications)
- Route53 + ACM automation module
- Automated Lighthouse CI regression gate
- Rate limiting + upstream retry policy tuning

## 12. Incident Response

1. Acknowledge & classify severity
2. Capture logs (proxy + CloudFront if available)
3. Mitigate (rollback or patch)
4. Post-mortem: Add AGENTUPDATEHISTORY entry with change_type=docs
