#!/bin/bash

# Simple script to kill all development processes
echo "🧹 Killing all development processes..."

# Kill processes on specific ports
for port in 4000 5173; do
    pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "🔄 Killing processes on port $port: $pids"
        kill -9 $pids 2>/dev/null || true
    else
        echo "✅ Port $port is already free"
    fi
done

echo "✅ Cleanup complete!"
