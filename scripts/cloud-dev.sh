#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
# Disable AWS CLI pager to avoid blocking output
export AWS_PAGER="" AWS_CLI_PAGER="" AWS_CLI_AUTO_PROMPT=off

# Core environment exports (provide defaults if not already set)
export AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test}
export AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test}
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-$REGION}
LOCAL_DYNAMO=${LOCAL_DYNAMO:-1}
LOCAL_ENDPOINT=${DYNAMODB_ENDPOINT:-http://localhost:8000}
export OWM_API_KEY=${OWM_API_KEY:-c936b44e0480ef48e6b25612bd949125}
export FIRMS_MAP_KEY=${FIRMS_MAP_KEY:-fa4e409ce1e5037b60bd85114fa6e7fd}
export NWS_USER_AGENT=${NWS_USER_AGENT:-Vortexa/0.1 (contact: chroniicallydiistracted@gmail.com)}
TABLE="${ALERTS_TABLE:-westfam-alerts}"
export ALERTS_TABLE="$TABLE"
SK_VERSION="${ALERT_SK_VERSION:-v0}"
RECREATE=0
SEED=1

for arg in "$@"; do
  case "$arg" in
    --recreate) RECREATE=1 ;;
    --no-seed) SEED=0 ;;
  --remote) LOCAL_DYNAMO=0 ;;
  esac
done

echo "[cloud-dev] Region : $REGION"
echo "[cloud-dev] Table  : $TABLE"
if [[ $LOCAL_DYNAMO -eq 1 ]]; then
  echo "[cloud-dev] Using local DynamoDB at $LOCAL_ENDPOINT"
else
  echo "[cloud-dev] Using AWS DynamoDB (region $REGION)"
fi
echo "[cloud-dev] OWM_API_KEY=${OWM_API_KEY:0:6}... FIRMS_MAP_KEY=${FIRMS_MAP_KEY:0:6}..."

# Ensure required dev ports are free (proxy:4000, web:5173)
free_port(){
  local PORT=$1; local NAME=$2; local ATTEMPTS=3;
  for a in $(seq 1 $ATTEMPTS); do
    local PIDS=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    if [[ -z "$PIDS" ]]; then return 0; fi
    echo "[cloud-dev] Killing existing $NAME process(es) on :$PORT -> $PIDS (attempt $a/$ATTEMPTS)"
    echo "$PIDS" | xargs -r kill || true
    sleep 0.5
    local SURV=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$SURV" ]]; then echo "$SURV" | xargs -r kill -9 || true; sleep 0.5; fi
    local FINAL=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    [[ -z "$FINAL" ]] && return 0
  done
  echo "[cloud-dev] ERROR: Could not free port $PORT after attempts" >&2
  exit 11
}

free_port 4000 proxy
free_port 5173 web

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
if [[ $LOCAL_DYNAMO -eq 1 ]]; then
  # Start local dynamodb if needed
  if ! nc -z localhost 8000 2>/dev/null; then
    # Remove exited container if present
    if docker ps -a --format '{{.Names}}' | grep -q '^dynamodb-local$'; then
      status=$(docker ps -a --filter name=dynamodb-local --format '{{.Status}}')
      echo "[cloud-dev] Removing prior dynamodb-local container (status: $status)";
      docker rm -f dynamodb-local >/dev/null 2>&1 || true
    fi
    echo "[cloud-dev] Starting local dynamodb container"
    docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -sharedDb >/dev/null 2>&1 || true
    for i in {1..20}; do
      if nc -z localhost 8000 2>/dev/null; then break; fi; sleep 0.5; done
  fi
  if ! nc -z localhost 8000 2>/dev/null; then
    echo "[cloud-dev] ERROR: local DynamoDB failed to start" >&2
    exit 1
  fi
  EP_FLAG=(--endpoint-url "$LOCAL_ENDPOINT")
  if ! aws dynamodb describe-table --table-name "$TABLE" "${EP_FLAG[@]}" >/dev/null 2>&1; then
    aws dynamodb create-table \
      --table-name "$TABLE" \
      --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
      --billing-mode PAY_PER_REQUEST \
      "${EP_FLAG[@]}"
    aws dynamodb wait table-exists --table-name "$TABLE" "${EP_FLAG[@]}"
  else
    echo "[cloud-dev] Table already exists (local)"
  fi
else
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
    echo "[cloud-dev] Table already exists (aws)"
  fi
fi

if [[ $SEED -eq 1 ]]; then
  echo "[cloud-dev] Seeding one sample alert via lambda handler code"
  ( cd services/alerts && \
    pnpm install --no-audit --no-fund >/dev/null 2>&1 && \
    pnpm run build >/dev/null 2>&1 && \
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
