terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

# Default provider (your working region, e.g., us-west-2)
provider "aws" {
  region = var.region
}

# us-east-1 provider for ACM (CloudFront certs MUST live in us-east-1)
provider "aws" {
  alias  = "use1"
  region = "us-east-1"
}

# -------------------------
# S3 buckets
# -------------------------
resource "aws_s3_bucket" "web" {
  bucket = var.web_bucket
}

resource "aws_s3_bucket" "data" {
  bucket = var.data_bucket
}

resource "aws_s3_bucket" "tile_cache" {
  count  = var.proxy_cache_bucket == "" ? 0 : 1
  bucket = var.proxy_cache_bucket
}

# --- S3 Public Access Block (KEEP BUCKETS PRIVATE) ---
resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "tile_cache" {
  count                   = var.proxy_cache_bucket == "" ? 0 : 1
  bucket                  = aws_s3_bucket.tile_cache[0].id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# -------------------------
# CloudFront (OAC + custom domain)
# -------------------------
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.web_bucket}-oac"
  description                       = "OAC for web bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"

  # >>> Custom domain(s) for the distro (add more if needed)
  aliases = var.domain_name == "" ? [] : [var.domain_name]

  # Validation logic: Either BOTH domain_name & acm_certificate_arn are empty (use default CF domain)
  # or BOTH are set (custom domain + cert). Implemented as lifecycle.precondition (must live inside
  # lifecycle block – prior top-level placement caused an "Unsupported block type" error).

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id

    # Provider v5.60 still requires this field even with OAC; leave it empty.
    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificate selection logic:
  # 1. If no custom domain, use CloudFront default cert.
  # 2. If custom domain AND external ACM ARN supplied via var.acm_certificate_arn, use that.
  # 3. (Optional future) If you want Terraform to request a cert & DNS validate, add resources
  #    separately (kept out to avoid forcing Route53 management here).
  dynamic "viewer_certificate" {
    for_each = var.domain_name == "" ? [0] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.domain_name != "" && var.acm_certificate_arn != "" ? [0] : []
    content {
      acm_certificate_arn      = var.acm_certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  # If you supply an ACM certificate ARN, ensure it lives in us-east-1.
  lifecycle {
    ignore_changes = [viewer_certificate]
    precondition {
      condition     = (var.domain_name == "" && var.acm_certificate_arn == "") || (var.domain_name != "" && var.acm_certificate_arn != "")
      error_message = "If domain_name is set you must also set acm_certificate_arn; leave both empty to use the default CloudFront domain/cert."
    }
  }
}

# -------------------------
# Allow ONLY this CloudFront distribution (via OAC) to read S3 web bucket
# -------------------------
data "aws_caller_identity" "me" {}

resource "aws_s3_bucket_policy" "web_allow_cf_oac" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowCloudFrontOACRead",
        Effect    = "Allow",
        Principal = { "Service" : "cloudfront.amazonaws.com" },
        Action    = ["s3:GetObject"],
        Resource  = "${aws_s3_bucket.web.arn}/*",
        Condition = {
            StringEquals = {
              "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.me.account_id}:distribution/${aws_cloudfront_distribution.cdn.id}"
            }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.web,
    aws_cloudfront_distribution.cdn
  ]
}

# -------------------------
# DynamoDB for alerts
# -------------------------
resource "aws_dynamodb_table" "alerts" {
  name         = "${var.name}-alerts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# -------------------------
# Lambda for alerts
# -------------------------
resource "aws_iam_role" "lambda_role" {
  name = "${var.name}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

# Basic logs
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Minimal DynamoDB access for the alerts table
resource "aws_iam_policy" "lambda_ddb_policy" {
  name        = "${var.name}-alerts-ddb"
  description = "Allow Lambda to read/write to the alerts table"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:DescribeTable"
        ],
        Resource = [
          aws_dynamodb_table.alerts.arn,
          "${aws_dynamodb_table.alerts.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ddb_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_ddb_policy.arn
}

resource "aws_lambda_function" "alerts" {
  function_name = "${var.name}-alerts"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"

  # Your zip must contain dist/index.js exporting `handler`
  handler          = "dist/index.handler"
  filename         = var.alerts_zip
  source_code_hash = filebase64sha256(var.alerts_zip)

  environment {
    variables = {
      TABLE          = aws_dynamodb_table.alerts.name
      NWS_USER_AGENT = var.nws_user_agent
    }
  }
}

# Keep logs tidy (14 days)
resource "aws_cloudwatch_log_group" "alerts" {
  name              = "/aws/lambda/${aws_lambda_function.alerts.function_name}"
  retention_in_days = 14
}

# -------------------------
# EventBridge 5-min schedule → Lambda
# -------------------------
resource "aws_cloudwatch_event_rule" "alerts" {
  name                = "${var.name}-alerts-5min"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "alerts" {
  rule = aws_cloudwatch_event_rule.alerts.name
  arn  = aws_lambda_function.alerts.arn
}

resource "aws_lambda_permission" "alerts" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alerts.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.alerts.arn
}

# -------------------------
# Variables & Outputs
# -------------------------
variable "region"        { type = string }
variable "name"          { type = string }
variable "web_bucket"    { type = string }
variable "data_bucket"   { type = string }
variable "alerts_zip"    { type = string }
variable "nws_user_agent" {
  type    = string
  default = ""
}
variable "proxy_cache_bucket" {
  type    = string
  default = ""
}

# Custom domain for CloudFront (set to "" to skip custom domain)
variable "domain_name" {
  description = "FQDN to serve via CloudFront (e.g., weather.westfam.media). Leave empty string to skip."
  type        = string
  default     = ""
  # NOTE: Cross-variable validation moved to aws_cloudfront_distribution.cdn precondition
  # because variable validation blocks cannot reference other variables.
}

# Optional existing ACM certificate ARN (must be in us-east-1). If provided along with domain_name,
# the distribution will use this certificate. If empty, and domain_name is set, you must separately
# provision & validate an ACM cert and re-apply with the ARN.
variable "acm_certificate_arn" {
  description = "Existing ACM certificate ARN in us-east-1 for the custom domain (leave blank to use default cert)."
  type        = string
  default     = ""
  validation {
    condition     = var.acm_certificate_arn == "" || can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.acm_certificate_arn))
    error_message = "acm_certificate_arn must be an ACM certificate ARN in us-east-1."
  }
}

output "cdn_domain" {
  value       = aws_cloudfront_distribution.cdn.domain_name
  description = "CloudFront distribution domain"
}
