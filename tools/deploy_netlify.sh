#!/bin/bash
# Pubblica la webapp su Netlify (sito attendance-app-it) e verifica che online ci sia il file nuovo.
# Il token Netlify non sta qui: lo aggiunge il proxy dell'ambiente alle richieste verso api.netlify.com.
set -euo pipefail
SITE_ID="d34b7ae6-c7c7-450c-a8f4-b66e0d63053f"
SITE_URL="https://attendance-app-it.netlify.app"
API="https://api.netlify.com/api/v1"
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
FILES=(index.html sw.js manifest.webmanifest icon-192.png icon-512.png)
# versione di prova (nuova interfaccia a calendario): $SITE_URL/prova/ — i programmi Windows/Android usano solo /index.html
[ -f prova/index.html ] && FILES+=(prova/index.html prova/sw.js prova/manifest.webmanifest prova/icon-192.png prova/icon-512.png)
# installatore Windows (creato con tools/windows/build.sh, non è nel repository): scaricabile da $SITE_URL/download/attendance-setup.exe (Netlify vuole i nomi in minuscolo)
[ -f download/attendance-setup.exe ] && FILES+=(download/attendance-setup.exe)
# app Android (creata con tools/android/build.sh): scaricabile da $SITE_URL/download/attendance.apk
[ -f download/attendance.apk ] && FILES+=(download/attendance.apk)
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED); [z.write(f) for f in sys.argv[2:]]; z.close()" "$TMP/sito.zip" "${FILES[@]}"
curl -sS -X POST -H "Content-Type: application/zip" --data-binary @"$TMP/sito.zip" "$API/sites/$SITE_ID/deploys" -o "$TMP/dep.json"
DEP=$(python3 -c "import json,sys; j=json.load(open(sys.argv[1])); print(j.get('id') or ''); sys.stderr.write('deploy: %s %s %s\n' % (j.get('id'), j.get('state'), j.get('message') or ''))" "$TMP/dep.json")
[ -n "$DEP" ] || { echo "ERRORE: Netlify non ha accettato il caricamento"; exit 1; }
for i in $(seq 1 60); do
  STATE=$(curl -sS "$API/deploys/$DEP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state'))")
  [ "$STATE" = "ready" ] && break
  [ "$STATE" = "error" ] && { echo "ERRORE: pubblicazione fallita"; exit 1; }
  sleep 3
done
[ "$STATE" = "ready" ] || { echo "ERRORE: pubblicazione non pronta (stato $STATE)"; exit 1; }
LIVE=$(curl -sS "$API/sites/$SITE_ID" | python3 -c "import json,sys; print((json.load(sys.stdin).get('published_deploy') or {}).get('id'))")
[ "$LIVE" = "$DEP" ] || { echo "ERRORE: online c'è ancora il deploy $LIVE"; exit 1; }
# controllo dei file pubblicati tramite l'API (il sito stesso può non essere raggiungibile da qui)
curl -sS "$API/deploys/$DEP/files" -o "$TMP/files.json"
python3 - "$TMP/files.json" "${FILES[@]}" <<'EOF'
import json, sys, hashlib
online = {f["id"]: f["sha"] for f in json.load(open(sys.argv[1]))}
bad = [n for n in sys.argv[2:] if online.get("/" + n) != hashlib.sha1(open(n, "rb").read()).hexdigest()]
if bad: sys.exit("ERRORE: online diversi da quelli locali: " + ", ".join(bad))
EOF
echo "OK: pubblicato $SITE_URL (deploy $DEP), tutti i file online identici a quelli locali"
