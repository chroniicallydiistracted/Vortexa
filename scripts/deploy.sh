#!/usr/bin/env bash
set -euo pipefail

if [ -z "${WEB_BUCKET:-}" ]; then
	echo "WEB_BUCKET env var required" >&2
	exit 1
fi

echo "[deploy] Build web..."
npm -w web run build

echo "[deploy] Package alerts (deterministic) & verify checksum..."
npm run package:alerts >/dev/null

ZIP="services/alerts/dist-zip/alerts.zip"
CHECK="${ZIP}.sha256"
if [ ! -f "$ZIP" ] || [ ! -s "$ZIP" ]; then
	echo "[deploy] ERROR: Lambda zip missing or empty" >&2
	exit 1
fi
if [ ! -f "$CHECK" ]; then
	echo "[deploy] ERROR: Checksum file missing: $CHECK" >&2
	exit 1
fi
ACTUAL=$(sha256sum "$ZIP" | awk '{print $1}')
RECORDED=$(awk '{print $1}' "$CHECK")
if [ "$ACTUAL" != "$RECORDED" ]; then
	echo "[deploy] ERROR: Checksum mismatch ($ACTUAL != $RECORDED)" >&2
	exit 1
fi
echo "[deploy] Checksum verified ($ACTUAL)"

echo "[deploy] Sync web to S3 (requires AWS env)..."
aws s3 sync web/dist s3://$WEB_BUCKET/ --delete
echo "[deploy] Done."
