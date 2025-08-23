#!/usr/bin/env bash
set -euo pipefail

MODE="soft" # default signal TERM then KILL fallback
REGION="${AWS_REGION:-us-west-2}"
TABLE="${ALERTS_TABLE:-westfam-alerts}"
DROP_TABLE=1
for arg in "$@"; do
  case "$arg" in
    --hard) MODE="hard" ;;
    --keep-table) DROP_TABLE=0 ;;
  esac
done
if [[ "${1:-}" == "--hard" ]]; then MODE="hard"; fi

echo "[cloud-dev-down] Scanning for dev processes (proxy: tsx watch, web: vite)"
MAP_PIDS=()
while IFS= read -r line; do
  pid=$(echo "$line" | awk '{print $1}')
  cmd=$(echo "$line" | cut -d' ' -f2-)
  [[ -z "$pid" ]] && continue
  MAP_PIDS+=("$pid:$cmd")
done < <(ps -eo pid=,command= | grep -E "(tsx watch src/index.ts|vite)" | grep -v grep || true)

if [[ ${#MAP_PIDS[@]} -eq 0 ]]; then
  echo "[cloud-dev-down] No matching dev processes found."; exit 0;
fi

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

if [[ $DROP_TABLE -eq 1 ]]; then
  echo "[cloud-dev-down] Deleting DynamoDB table $TABLE (override with --keep-table)"
  aws dynamodb delete-table --table-name "$TABLE" --region "$REGION" 2>/dev/null || echo "[cloud-dev-down] Table delete skipped or failed" 
fi

echo "[cloud-dev-down] Done."
