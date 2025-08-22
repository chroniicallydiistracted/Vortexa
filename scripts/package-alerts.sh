#!/usr/bin/env bash
# Deterministically package the alerts Lambda (prod deps only) and emit sha256.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.."; pwd)
ALERTS_DIR="$ROOT/services/alerts"
ZIP_DIR="$ALERTS_DIR/dist-zip"
ZIP_PATH="$ZIP_DIR/alerts.zip"

echo "[package-alerts] Using Node: $(node -v)"
pushd "$ALERTS_DIR" >/dev/null

echo "[package-alerts] Installing full deps (for build)..."
npm ci --no-audit --no-fund

echo "[package-alerts] Building TypeScript..."
npm run build

echo "[package-alerts] Pruning to production deps..."
npm prune --omit=dev --no-audit --no-fund

mkdir -p "$ZIP_DIR"
rm -f "$ZIP_PATH"

# Create deterministic file list (exclude unnecessary files)
INCLUDE_PATHS=(dist node_modules package.json package-lock.json)

echo "[package-alerts] Generating deterministic file list..."
FILE_LIST=$(mktemp)
for p in "${INCLUDE_PATHS[@]}"; do
	if [ -e "$p" ]; then
		# Include regular files only
		find "$p" -type f -print
	fi
done | LC_ALL=C sort > "$FILE_LIST"

echo "[package-alerts] Zipping ${ZIP_PATH} ..."
zip -X -q -@ "$ZIP_PATH" < "$FILE_LIST"
rm "$FILE_LIST"

if [ ! -s "$ZIP_PATH" ]; then
	echo "[package-alerts] ERROR: Zip not created or empty" >&2
	exit 1
fi

SHA256=$(sha256sum "$ZIP_PATH" | awk '{print $1}')
BYTES=$(stat -c %s "$ZIP_PATH")
echo "[package-alerts] Created: $ZIP_PATH (${BYTES} bytes, sha256=$SHA256)"
popd >/dev/null

echo "$SHA256  $ZIP_PATH" > "$ZIP_PATH.sha256"
echo "[package-alerts] Wrote checksum: $ZIP_PATH.sha256"
