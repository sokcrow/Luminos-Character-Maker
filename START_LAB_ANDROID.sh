#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

TARGET_FOLDER="Luminos-Character-Maker-feat-item-icon-families"
SCRIPT=""

for root in /sdcard/Download /storage/emulated/0/Download; do
  [ -d "$root" ] || continue
  SCRIPT="$(find "$root" -maxdepth 7 -type f -path "*/${TARGET_FOLDER}*/game-engine/START_LAB_ANDROID.sh" -print 2>/dev/null | tail -n 1)"
  [ -n "$SCRIPT" ] && break
done

if [ -z "$SCRIPT" ] || [ ! -f "$SCRIPT" ]; then
  echo "No encontré ${TARGET_FOLDER} dentro de Download."
  exit 1
fi

exec bash "$SCRIPT"
