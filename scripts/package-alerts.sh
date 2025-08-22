#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.."; pwd)
pushd "$ROOT/services/alerts" >/dev/null
npm i
npm run build
mkdir -p dist-zip
cd dist
zip -r ../dist-zip/alerts.zip .
popd >/dev/null
echo "Created: $ROOT/services/alerts/dist-zip/alerts.zip"
