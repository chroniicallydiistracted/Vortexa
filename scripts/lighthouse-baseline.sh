#!/usr/bin/env bash
# Simple Lighthouse run script (requires Chrome & node 'lighthouse' globally or via npx)
# Usage: BASE_URL=https://weather.westfam.media ./scripts/lighthouse-baseline.sh
set -euo pipefail
URL=${BASE_URL:-http://localhost:5173}
OUT_DIR=./lighthouse
mkdir -p "$OUT_DIR"
TS=$(date -u +%Y%m%dT%H%M%SZ)
JSON="$OUT_DIR/report-$TS.json"
HTML="$OUT_DIR/report-$TS.html"

npx lighthouse "$URL" --quiet --output json --output html --output-path "$OUT_DIR/report-$TS" --only-categories=performance,accessibility,best-practices,seo 1>/dev/null

# Extract scores
perf=$(jq '.categories.performance.score*100' < "$JSON")
acc=$(jq '.categories.accessibility.score*100' < "$JSON")
BP=$(jq '.categories["best-practices"].score*100' < "$JSON")
seo=$(jq '.categories.seo.score*100' < "$JSON")
line="$TS,$URL,$perf,$acc,$BP,$seo"
if [ ! -f "$OUT_DIR/summary.csv" ]; then echo "timestamp,url,performance,accessibility,best_practices,seo" > "$OUT_DIR/summary.csv"; fi
echo "$line" >> "$OUT_DIR/summary.csv"
echo "Lighthouse scores: perf=$perf a11y=$acc bp=$BP seo=$seo (saved to $JSON / $HTML)"
