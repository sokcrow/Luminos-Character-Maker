#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/.." && pwd)"
SERVER="$PROJECT_ROOT/game-engine/lab-server.mjs"
PORT="${LUMINOUS_LAB_PORT:-7777}"
URL="http://localhost:${PORT}/game-engine/lab/"

if [ ! -f "$SERVER" ]; then
  echo "No encontré el servidor del Lab en:"
  echo "  $SERVER"
  exit 1
fi

if command -v pkill >/dev/null 2>&1; then
  pkill -f "node .*game-engine/lab-server\.mjs" 2>/dev/null || true
  sleep 0.3
fi

node "$SERVER" &
PID=$!

cleanup() {
  kill "$PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1

if ! kill -0 "$PID" 2>/dev/null; then
  wait "$PID"
  exit 1
fi

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" >/dev/null 2>&1 || true
elif [ -x /system/bin/am ]; then
  /system/bin/am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1 || true
else
  echo "Abre manualmente:"
  echo "  $URL"
fi

echo "Luminous Lab: $URL"
echo "Ctrl+C para cerrar."
wait "$PID"
