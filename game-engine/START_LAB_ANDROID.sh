#!/data/data/com.termux/files/usr/bin/bash
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
URL="http://localhost:${LUMINOUS_LAB_PORT:-7777}/game-engine/lab/"

node "$HERE/lab-server.mjs" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" >/dev/null 2>&1 || true
fi

echo "Luminous Game Engine Lab: $URL"
wait "$SERVER_PID"
