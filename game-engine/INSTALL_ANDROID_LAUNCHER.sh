#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

DEST="$HOME/luminous-lab"

cat > "$DEST" <<'LUMINOUS_LAUNCHER'
#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

TARGET_FOLDER="Luminos-Character-Maker-feat-item-icon-families"
PORT="${LUMINOUS_LAB_PORT:-7777}"
URL="http://localhost:${PORT}/game-engine/lab/"
BEST=""
BEST_MTIME=0

for root in /sdcard/Download /storage/emulated/0/Download; do
  [ -d "$root" ] || continue
  while IFS= read -r -d '' file; do
    case "$file" in
      *"/${TARGET_FOLDER}"*/game-engine/lab-server.mjs)
        mtime="$(stat -c %Y "$file" 2>/dev/null || echo 0)"
        if [ "$mtime" -ge "$BEST_MTIME" ]; then
          BEST_MTIME="$mtime"
          BEST="$file"
        fi
        ;;
    esac
  done < <(find "$root" -maxdepth 7 -type f -name "lab-server.mjs" -print0 2>/dev/null)
done

if [ -z "$BEST" ] || [ ! -f "$BEST" ]; then
  echo "No encontré ${TARGET_FOLDER} dentro de Download."
  echo "Descomprime el ZIP del PR777 y vuelve a ejecutar: ~/luminous-lab"
  exit 1
fi

echo "Usando:"
echo "  $(cd "$(dirname "$BEST")/.." && pwd)"

if command -v pkill >/dev/null 2>&1; then
  pkill -f "node .*game-engine/lab-server\.mjs" 2>/dev/null || true
  sleep 0.3
fi

node "$BEST" &
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
  echo "Abre manualmente: $URL"
fi

echo "Luminous Game Engine Lab: $URL"
echo "Ctrl+C para cerrar."
wait "$PID"
LUMINOUS_LAUNCHER

chmod +x "$DEST"

echo "Launcher instalado:"
echo "  $DEST"
echo
echo "A partir de ahora, después de descomprimir una versión nueva en Download,"
echo "sólo ejecuta:"
echo "  ~/luminous-lab"
echo
echo "Abriendo el Lab ahora..."
exec "$DEST"
