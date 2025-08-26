#!/bin/bash

# Robust dev-all script that kills existing processes and starts fresh
set -e

echo "🚀 Starting Vortexa development environment..."

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "🔄 Killing processes on port $port: $pids"
        kill -9 $pids 2>/dev/null || true
        sleep 1
    fi
}

# Function to check if port is free
check_port() {
    local port=$1
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "❌ Port $port is still in use after cleanup attempt"
        return 1
    fi
    return 0
}

# Clean up existing processes
echo "🧹 Cleaning up existing processes..."
kill_port 4000  # Proxy service
kill_port 5173  # Web service

# Wait a moment for cleanup
sleep 2

# Verify ports are free
if ! check_port 4000; then
    echo "❌ Failed to free port 4000"
    exit 1
fi

if ! check_port 5173; then
    echo "❌ Failed to free port 5173"
    exit 1
fi

echo "✅ Ports cleared successfully"

# Start services with concurrently
echo "🚀 Starting services with concurrently..."
exec npx concurrently -n proxy,web -c blue,green \
    "pnpm dev:proxy" \
    "pnpm dev:web"
