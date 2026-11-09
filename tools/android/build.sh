#!/bin/bash
# Crea l'app Android di Attendance (Attendance.apk) a partire dall'index.html del progetto.
# Uso: bash tools/android/build.sh <cartella-di-lavoro>
# Serve: apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 (+ JDK con javac/keytool).
# La chiave di firma sta in android-key/ (ignorata da git): va conservata, altrimenti gli aggiornamenti
# dell'app richiedono di disinstallarla (e i dati salvati andrebbero persi).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
W="${1:?indica una cartella di lavoro}"; mkdir -p "$W"; cd "$W"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
KD="$REPO/android-key"; KS="$KD/attendance.jks"; KP="$KD/password.txt"
if [ ! -f "$KS" ]; then
  mkdir -p "$KD"; python3 -c "import secrets; print(secrets.token_urlsafe(24))" > "$KP"
  keytool -genkeypair -keystore "$KS" -alias attendance -keyalg RSA -keysize 2048 -validity 15000 \
    -storepass "$(cat "$KP")" -keypass "$(cat "$KP")" -dname "CN=Attendance, O=Attendance, C=IT" 2>/dev/null
fi
rm -rf apk && mkdir -p apk/classes apk/assets/www && cd apk
cp "$REPO/index.html" "$REPO/icon-192.png" "$REPO/icon-512.png" assets/www/
javac -nowarn --release 8 -cp "$JAR" -d classes $(find "$HERE/src" -name '*.java') 2>&1 | grep -v "JAVA_TOOL_OPTIONS" || true
dalvik-exchange --dex --min-sdk-version=24 --output=classes.dex classes
aapt package -f -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -A assets -I "$JAR" -F unsigned.apk
aapt add unsigned.apk classes.dex >/dev/null
zipalign -f -p 4 unsigned.apk aligned.apk
apksigner sign --ks "$KS" --ks-pass "file:$KP" --out Attendance.apk aligned.apk
apksigner verify Attendance.apk && echo "firma ok"
ls -la "$W/apk/Attendance.apk"
