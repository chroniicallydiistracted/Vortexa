#!/usr/bin/env bash
set -euo pipefail

# Simple orchestrator: export env, ensure local dynamodb, start proxy, run health check.
# Load local overrides if present (do NOT commit .env.local)
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi

export AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test}
export AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test}
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-west-2}

export OWM_API_KEY=${OWM_API_KEY?Set OWM_API_KEY}
export FIRMS_MAP_KEY=${FIRMS_MAP_KEY?Set FIRMS_MAP_KEY}
export NWS_USER_AGENT=${NWS_USER_AGENT:-Vortexa/0.1 (contact: dev@westfam.media)}
export ALERTS_TABLE=${ALERTS_TABLE:-westfam-alerts}
export DYNAMODB_ENDPOINT=${DYNAMODB_ENDPOINT:-http://localhost:8000}

echo "[dev-health] Environment configured; region=$AWS_DEFAULT_REGION"

# Ensure no prior processes hold required ports (proxy:4000)
free_port(){
  local PORT=$1; local NAME=$2; local ATTEMPTS=3;
  for a in $(seq 1 $ATTEMPTS); do
    local PIDS=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    if [[ -z "$PIDS" ]]; then return 0; fi
    echo "[dev-health] Killing existing $NAME process(es) on :$PORT -> $PIDS (attempt $a/$ATTEMPTS)"
    echo "$PIDS" | xargs -r kill || true
    sleep 0.5
    # escalate
    local SURV=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$SURV" ]]; then
      echo "$SURV" | xargs -r kill -9 || true
      sleep 0.5
    fi
    local FINAL=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    [[ -z "$FINAL" ]] && return 0
  done
  echo "[dev-health] ERROR: Could not free port $PORT after attempts" >&2
  exit 10
}

free_port 4000 proxy

# Start DynamoDB local if not running (docker required)
if ! nc -z localhost 8000 2>/dev/null; then
  echo "[dev-health] Starting dynamodb-local container"
  docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -sharedDb >/dev/null
  # wait for port
  for i in {1..15}; do
    if nc -z localhost 8000 2>/dev/null; then break; fi
    sleep 1
  done
fi

if ! nc -z localhost 8000 2>/dev/null; then
  echo "[dev-health] ERROR: dynamodb-local did not start" >&2
  exit 1
fi

echo "[dev-health] Ensuring table $ALERTS_TABLE exists"
aws dynamodb describe-table --table-name "$ALERTS_TABLE" --endpoint-url http://localhost:8000 >/dev/null 2>&1 || {
  aws dynamodb create-table \
    --table-name "$ALERTS_TABLE" \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url http://localhost:8000 >/dev/null
  aws dynamodb wait table-exists --table-name "$ALERTS_TABLE" --endpoint-url http://localhost:8000
}

echo "[dev-health] Seeding one alert item"
aws dynamodb put-item --table-name "$ALERTS_TABLE" --endpoint-url http://localhost:8000 --item '{"pk":{"S":"alert#LOCALTEST"},"sk":{"S":"v1"},"data":{"M":{"id":{"S":"LOCALTEST"},"properties":{"M":{"event":{"S":"Test Alert"},"headline":{"S":"Local Test Weather Alert"},"severity":{"S":"Moderate"},"certainty":{"S":"Observed"},"effective":{"S":"2025-08-24T00:00:00Z"},"expires":{"S":"2025-08-24T01:00:00Z"}}},"geometry":{"M":{"type":{"S":"Point"},"coordinates":{"L":[{"N":"-122.4"},{"N":"37.78"}]}}}}},"ttl":{"N":"9999999999"}}' >/dev/null || true

echo "[dev-health] Starting proxy (background)"
PORT=4000 npm -w services/proxy run dev >/tmp/dev-health-proxy.log 2>&1 &
PROXY_PID=$!

cleanup() { echo "[dev-health] Stopping proxy (PID $PROXY_PID)"; kill $PROXY_PID 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# wait for proxy
for i in {1..20}; do
  if nc -z localhost 4000 2>/dev/null; then break; fi
  sleep 0.5
done

if ! nc -z localhost 4000 2>/dev/null; then
  echo "[dev-health] ERROR: proxy failed to start (port not open)" >&2
  echo "[dev-health] Proxy log:"; tail -n 40 /tmp/dev-health-proxy.log || true
  exit 2
fi

# Quick EADDRINUSE check in log
if grep -q "EADDRINUSE" /tmp/dev-health-proxy.log 2>/dev/null; then
  echo "[dev-health] ERROR: EADDRINUSE detected even after kill attempt" >&2
  tail -n 40 /tmp/dev-health-proxy.log || true
  exit 3
fi

echo "[dev-health] Running health-check"
npm -w services/proxy run health-check || true

echo "[dev-health] Tail proxy log (last 20 lines):"
tail -n 20 /tmp/dev-health-proxy.log || true

echo "[dev-health] Done"