#!/usr/bin/env bash
set -euo pipefail
echo "Build web..."
npm -w web run build
echo "Sync to S3 (requires AWS env)..."
aws s3 sync web/dist s3://$WEB_BUCKET/ --delete
echo "Done."
