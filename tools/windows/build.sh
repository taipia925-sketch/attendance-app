#!/bin/bash
# Crea l'installatore Windows di Attendance (Attendance-Setup.exe) a partire dall'index.html del progetto.
# Uso: bash tools/windows/build.sh <cartella-di-lavoro>   (fuori dal repository, es. nello scratchpad)
# Serve: node/npm, makensis (apt-get install nsis), python3 con PIL. Scarica Electron per Windows da GitHub.
set -euo pipefail
EV=33.2.1
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
W="${1:?indica una cartella di lavoro}"; mkdir -p "$W"; cd "$W"
[ -d dev/node_modules/resedit ] || (mkdir -p dev && cd dev && npm init -y >/dev/null && npm install --no-audit --no-fund resedit@2 >/dev/null)
if [ ! -f electron-win.zip ]; then
  curl -sSL -o electron-win.zip "https://github.com/electron/electron/releases/download/v$EV/electron-v$EV-win32-x64.zip"
  curl -sSL -o SHASUMS256.txt "https://github.com/electron/electron/releases/download/v$EV/SHASUMS256.txt"
  grep "electron-v$EV-win32-x64.zip" SHASUMS256.txt | sed 's/\*//' | awk '{print $1"  electron-win.zip"}' | sha256sum -c -
fi
rm -rf build && mkdir -p build/Attendance && (cd build/Attendance && unzip -q ../../electron-win.zip)
B=build/Attendance; mv $B/electron.exe $B/Attendance.exe; rm -f $B/resources/default_app.asar
(cd $B/locales && ls | grep -vE '^(it|en-US)\.pak$' | xargs rm -f)
mkdir -p $B/resources/app/www
cp "$HERE/main.js" "$HERE/preload.js" "$HERE/package.json" $B/resources/app/
cp "$REPO/index.html" "$REPO/icon-192.png" "$REPO/icon-512.png" $B/resources/app/www/
python3 -c "from PIL import Image; Image.open('$REPO/icon-512.png').convert('RGBA').save('build/attendance.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"
cp "$HERE/brand.js" dev/brand.js && (cd dev && node brand.js "$W/$B/Attendance.exe" "$W/build/attendance.ico")
cp "$HERE/installer.nsi" build/ && (cd build && makensis -V2 installer.nsi)
ls -la "$W/build/Attendance-Setup.exe"
