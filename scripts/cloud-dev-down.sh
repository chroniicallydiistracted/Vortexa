#!/usr/bin/env bash
set -euo pipefail

# Standard environment exports (mirror cloud-dev defaults)
REGION="${AWS_REGION:-us-west-2}"
# Load local overrides if present (do NOT commit .env.local)
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi

export AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test}
export AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test}
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-$REGION}
export OWM_API_KEY=${OWM_API_KEY?Set OWM_API_KEY}
export FIRMS_MAP_KEY=${FIRMS_MAP_KEY?Set FIRMS_MAP_KEY}
export NWS_USER_AGENT=${NWS_USER_AGENT:-Vortexa/0.1 (contact: dev@westfam.media)}
export ALERTS_TABLE=${ALERTS_TABLE:-westfam-alerts}
export DYNAMODB_ENDPOINT=${DYNAMODB_ENDPOINT:-http://localhost:8000}
LOCAL_DYNAMO=${LOCAL_DYNAMO:-1}

MODE="soft" # default signal TERM then KILL fallback
TABLE="$ALERTS_TABLE"
DROP_TABLE=1
REMOVE_LOCAL_CONTAINER=0
for arg in "$@"; do
  case "$arg" in
    --hard) MODE="hard" ;;
    --keep-table) DROP_TABLE=0 ;;
  --remote) LOCAL_DYNAMO=0 ;;
  --remove-local) REMOVE_LOCAL_CONTAINER=1 ;;
  esac
done
if [[ "${1:-}" == "--hard" ]]; then MODE="hard"; fi

echo "[cloud-dev-down] Region : $REGION"
echo "[cloud-dev-down] Table  : $TABLE"
if [[ $LOCAL_DYNAMO -eq 1 ]]; then
  echo "[cloud-dev-down] Mode   : local DynamoDB ($DYNAMODB_ENDPOINT)"; else echo "[cloud-dev-down] Mode   : remote AWS"; fi
echo "[cloud-dev-down] Environment configured; region=$AWS_DEFAULT_REGION"
echo "[cloud-dev-down] Scanning for dev processes (proxy: tsx watch, web: vite)"
MAP_PIDS=()
while IFS= read -r line; do
  pid=$(echo "$line" | awk '{print $1}')
  cmd=$(echo "$line" | cut -d' ' -f2-)
  [[ -z "$pid" ]] && continue
  MAP_PIDS+=("$pid:$cmd")
done < <(ps -eo pid=,command= | grep -E "(tsx watch src/index.ts|vite)" | grep -v grep || true)

if [[ ${#MAP_PIDS[@]} -eq 0 ]]; then
  echo "[cloud-dev-down] No matching dev processes found (still evaluating table deletion).";
  # Proceed directly to table deletion logic below
else
  echo "[cloud-dev-down] Found ${#MAP_PIDS[@]} process(es):"
  for pc in "${MAP_PIDS[@]}"; do
    pid=${pc%%:*}; cmd=${pc#*:}; echo " - PID $pid :: $cmd"; done

  echo "[cloud-dev-down] Sending SIGTERM..."
  for pc in "${MAP_PIDS[@]}"; do pid=${pc%%:*}; kill "$pid" 2>/dev/null || true; done

  sleep 1

  # Check survivors
  SURVIVORS=()
  for pc in "${MAP_PIDS[@]}"; do pid=${pc%%:*}; if kill -0 "$pid" 2>/dev/null; then SURVIVORS+=("$pid"); fi; done

  if [[ ${#SURVIVORS[@]} -gt 0 ]]; then
    if [[ "$MODE" == "hard" ]]; then
      echo "[cloud-dev-down] Forcing kill (SIGKILL) for: ${SURVIVORS[*]}"
      for pid in "${SURVIVORS[@]}"; do kill -9 "$pid" 2>/dev/null || true; done
    else
      echo "[cloud-dev-down] Some processes still running (use --hard to force): ${SURVIVORS[*]}"
    fi
  fi
fi

if [[ $DROP_TABLE -eq 1 ]]; then
  echo "[cloud-dev-down] Deleting DynamoDB table $TABLE (override with --keep-table)"
  if ! command -v aws >/dev/null 2>&1; then
    echo "[cloud-dev-down] aws CLI not installed; skipping table deletion";
  else
    if [[ $LOCAL_DYNAMO -eq 1 ]]; then
      EP=(--endpoint-url "$DYNAMODB_ENDPOINT")
      if aws dynamodb delete-table --table-name "$TABLE" "${EP[@]}" >/dev/null 2>&1; then
        echo "[cloud-dev-down] Local delete requested; waiting..."
        deleted=0
        for i in {1..30}; do
          if aws dynamodb describe-table --table-name "$TABLE" "${EP[@]}" >/dev/null 2>&1; then sleep 1; else deleted=1; break; fi
        done
        if [[ $deleted -eq 1 ]]; then echo "[cloud-dev-down] Table deletion confirmed (local)."; else echo "[cloud-dev-down] WARNING: Table still present (local)."; fi
      else
        echo "[cloud-dev-down] Local delete failed (may not exist).";
      fi
      if [[ $REMOVE_LOCAL_CONTAINER -eq 1 ]]; then
        if docker ps -a --format '{{.Names}}' | grep -q '^dynamodb-local$'; then
          echo "[cloud-dev-down] Removing local dynamodb container"; docker rm -f dynamodb-local >/dev/null 2>&1 || true; fi
      fi
    else
      if aws dynamodb delete-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
        echo "[cloud-dev-down] Delete requested; waiting for table removal..."
        deleted=0
        for i in {1..60}; do
          if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then sleep 1; else deleted=1; break; fi
        done
        if [[ $deleted -eq 1 ]]; then echo "[cloud-dev-down] Table deletion confirmed."; else echo "[cloud-dev-down] WARNING: Table still present after timeout."; fi
      else
        echo "[cloud-dev-down] Delete failed (see below).";
        aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" 2>&1 || true
      fi
    fi
  fi
fi

echo "[cloud-dev-down] Done."
