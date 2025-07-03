#!/bin/bash

echo "🔍 Checking for zombie development processes..."

# Function to safely kill processes
safe_kill() {
    local pids="$1"
    if [ -n "$pids" ]; then
        echo "$pids" | while read -r pid; do
            if [ -n "$pid" ] && [ "$pid" != "$$" ]; then
                if kill -0 "$pid" 2>/dev/null; then
                    echo "  Killing PID $pid: $(ps -p $pid -o comm= 2>/dev/null || echo 'unknown')"
                    kill -9 "$pid" 2>/dev/null
                fi
            fi
        done
    fi
}

# Check what's using common dev ports
echo "Processes using ports 3000-3002, 5173, 8080:"
port_pids=$(lsof -ti:3000,3001,3002,5173,8080 2>/dev/null)
if [ -n "$port_pids" ]; then
    echo "$port_pids" | while read -r pid; do
        if [ -n "$pid" ]; then
            echo "  PID $pid: $(ps -p $pid -o comm= 2>/dev/null || echo 'unknown')"
        fi
    done
else
    echo "  No processes found"
fi

echo "🧹 Killing zombie development processes..."

# Kill by port first (most reliable)
if [ -n "$port_pids" ]; then
    safe_kill "$port_pids"
    echo "  ✅ Killed processes using dev ports"
else
    echo "  ℹ️  No processes using dev ports"
fi

# Kill specific vite processes (but exclude current script)
vite_pids=$(pgrep -f 'vite.*dev' 2>/dev/null | grep -v "$$")
if [ -n "$vite_pids" ]; then
    safe_kill "$vite_pids"
    echo "  ✅ Killed Vite dev processes"
else
    echo "  ℹ️  No Vite dev processes found"
fi

# Kill webpack dev server
webpack_pids=$(pgrep -f 'webpack-dev-server' 2>/dev/null | grep -v "$$")
if [ -n "$webpack_pids" ]; then
    safe_kill "$webpack_pids"
    echo "  ✅ Killed Webpack dev server"
else
    echo "  ℹ️  No Webpack dev server found"
fi

echo "✨ Cleanup complete! You can now run 'pnpm dev' safely." 