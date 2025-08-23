#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
# Disable AWS CLI pager to avoid blocking output
export AWS_PAGER="" AWS_CLI_PAGER="" AWS_CLI_AUTO_PROMPT=off
TABLE="${ALERTS_TABLE:-westfam-alerts}"
SK_VERSION="${ALERT_SK_VERSION:-v0}"
RECREATE=0
SEED=1

for arg in "$@"; do
  case "$arg" in
    --recreate) RECREATE=1 ;;
    --no-seed) SEED=0 ;;
  esac
done

echo "[cloud-dev] Region: $REGION"
echo "[cloud-dev] Table : $TABLE"

if [[ $RECREATE -eq 1 ]]; then
  echo "[cloud-dev] Deleting existing table $TABLE (if present)"
  aws dynamodb delete-table --table-name "$TABLE" --region "$REGION" 2>/dev/null || true
  echo "[cloud-dev] Waiting for table deletion..."
  for i in {1..30}; do
    if ! aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

echo "[cloud-dev] Ensuring DynamoDB table schema pk+sk"
if ! aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "[cloud-dev] Waiting for table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
else
  echo "[cloud-dev] Table already exists"
fi

if [[ $SEED -eq 1 ]]; then
  echo "[cloud-dev] Seeding one sample alert via lambda handler code"
  ( cd alerts-lambda && \
    npm install --no-audit --no-fund >/dev/null 2>&1 && \
    npm run build >/dev/null 2>&1 && \
    node dist/index.js || echo "[cloud-dev] Seed run failed" )
else
  echo "[cloud-dev] Seeding skipped (--no-seed)"
fi

echo "[cloud-dev] Starting proxy & web (Ctrl+C to stop)"
npm run dev:proxy &
PROXY_PID=$!
sleep 1
npm run dev:web &
WEB_PID=$!

cleanup() {
  echo "\n[cloud-dev] Shutting down (proxy PID=$PROXY_PID web PID=$WEB_PID)";
  kill $PROXY_PID $WEB_PID 2>/dev/null || true
  wait $PROXY_PID $WEB_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[cloud-dev] Proxy  : http://localhost:4000/api/alerts"
echo "[cloud-dev] Web    : http://localhost:5173"
echo "[cloud-dev] Waiting on background processes..."
wait
