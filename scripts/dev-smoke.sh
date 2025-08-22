#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.."; pwd)

echo "Building shared..."
npm -w services/shared run build

echo "Starting proxy..."
(npm -w services/proxy run dev & echo $! > /tmp/proxy.pid) >/dev/null 2>&1 || true
sleep 2
echo -n "Proxy health: "; curl -sS http://127.0.0.1:4000/health || true
echo

echo "Killing proxy..."
kill $(cat /tmp/proxy.pid) >/dev/null 2>&1 || true
rm -f /tmp/proxy.pid
echo "Done"
