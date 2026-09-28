#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

TARGET_FOLDER="Luminos-Character-Maker-feat-item-icon-families"
PORT="${LUMINOUS_LAB_PORT:-7777}"
URL="http://localhost:${PORT}/game-engine/lab/"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

find_latest_server() {
  local best_path=""
  local best_mtime=0
  local root file mtime

  for root in /sdcard/Download /storage/emulated/0/Download; do
    [ -d "$root" ] || continue
    while IFS= read -r -d '' file; do
      case "$file" in
        *"/${TARGET_FOLDER}"*/game-engine/lab-server.mjs)
          mtime="$(stat -c %Y "$file" 2>/dev/null || echo 0)"
          if [ "$mtime" -ge "$best_mtime" ]; then
            best_mtime="$mtime"
            best_path="$file"
          fi
          ;;
      esac
    done < <(find "$root" -maxdepth 7 -type f -name "lab-server.mjs" -print0 2>/dev/null)
  done

  if [ -z "$best_path" ] && [ -f "$SELF_DIR/lab-server.mjs" ]; then
    best_path="$SELF_DIR/lab-server.mjs"
  fi

  printf '%s' "$best_path"
}

SERVER_FILE="$(find_latest_server)"

if [ -z "$SERVER_FILE" ] || [ ! -f "$SERVER_FILE" ]; then
  echo "No encontré el Lab dentro de:"
  echo "  /sdcard/Download/${TARGET_FOLDER}"
  echo
  echo "Descomprime primero el ZIP de PR777 dentro de Download y vuelve a ejecutar este script."
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$SERVER_FILE")/.." && pwd)"

echo "Luminous PR777 encontrado:"
echo "  $PROJECT_DIR"
echo

# Si quedó un servidor viejo de otra extracción, lo sustituimos por la copia más reciente.
if command -v pkill >/dev/null 2>&1; then
  pkill -f "node .*game-engine/lab-server\.mjs" 2>/dev/null || true
  sleep 0.3
fi

node "$SERVER_FILE" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "El servidor no pudo iniciar."
  wait "$SERVER_PID"
  exit 1
fi

echo "Abriendo:"
echo "  $URL"

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" >/dev/null 2>&1 || true
elif [ -x /system/bin/am ]; then
  /system/bin/am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1 || true
else
  echo "Abre esta dirección manualmente en tu navegador:"
  echo "  $URL"
fi

echo
echo "Deja Termux abierto mientras juegas. Ctrl+C cierra el Lab."
wait "$SERVER_PID"
