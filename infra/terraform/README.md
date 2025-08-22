# Terraform (minimal)
Creates:
- S3 buckets (web, data)
- CloudFront for the web bucket
- DynamoDB table (alerts)
- Alerts Lambda + 5‑minute schedule

> Extend with API Gateway + Lambda URL for the proxy, or ECS Fargate for high‑throughput tiles.

## Usage

```bash
terraform init
terraform apply \
	-var region=us-east-1 \
	-var name=westfam \
	-var web_bucket=westfam-web-123 \
	-var data_bucket=westfam-data-123 \
	-var alerts_zip=../../services/alerts/dist-zip/alerts.zip
```

## Environment

The Alerts Lambda honors `NWS_USER_AGENT` for requests to api.weather.gov (recommended by NWS). You can set this in the Lambda environment or extend `main.tf`:

```hcl
environment {
	variables = {
		TABLE          = aws_dynamodb_table.alerts.name
		NWS_USER_AGENT = "WestFamWeather/0.0.1 (you@example.com)"
	}
}
```
