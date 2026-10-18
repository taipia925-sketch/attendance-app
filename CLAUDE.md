# Attendance app

`index.html` è una pagina d'accesso (`tools/gate.html`) che contiene l'app vera cifrata (AES-GCM, chiave PBKDF2-SHA256 300000 iterazioni) nello `<script id="pl">`. Il codice d'accesso NON va mai scritto nel repository: chiedilo all'utente.

Il sito è pubblicato da GitHub Pages dal branch `main`. `sw.js` + `manifest.webmanifest` + `icon-*.png` rendono la webapp installabile e utilizzabile senza rete (strategia "prima la rete": gli aggiornamenti arrivano subito).

## Regola per ogni modifica richiesta
Ogni modifica va applicata a **entrambe** le versioni:
1. **Webapp**: il sito pubblicato dal branch `main`. Dopo aver verificato la modifica, porta i commit su `main` e fai push (oltre al branch di lavoro).
2. **App**: il file `index.html` scaricabile. Al termine invia all'utente il file `index.html` aggiornato (SendUserFile, display "attach").

## Come modificare
1. `python3 tools/app.py unpack <codice> <cartella>` (cartella fuori dal repo, es. nello scratchpad) → `<cartella>/app.html` piccolo e modificabile; le stringhe enormi (motore OCR Tesseract incorporato, modello Excel `TEMPLATE_B64`) restano come segnaposti `@@BLOBn@@`.
2. Modifica `app.html`: CSS e HTML in testa, poi lo script principale (liste uguali al Foglio2 del modello Excel, calcoli che replicano le formule del Foglio1, lettura screenshot, interfaccia).
3. Prova nel browser (Playwright, Chromium in /opt/pw-browsers): ricostruisci un file di prova con `build()` di `tools/app.py` o direttamente con `pack` su una copia.
   Per verificare l'Excel prodotto: togli i valori in cache dalle celle con formula e ricalcola con `soffice --headless --convert-to xlsx`, poi confronta J/X/AA e la riga 42 con i calcoli dell'app.
4. `python3 tools/app.py pack <codice> <cartella>` — ricifra con lo stesso codice dentro `index.html`.
5. Commit, push del branch e di `main`, poi invia `index.html` all'utente.

## Note sul codice dell'app
- Tendine: tutte le celle compilabili usano le liste del Foglio2; per velocità le tendine della tabella nascono "pigre" (`data-lazy`) e ricevono l'elenco completo al primo tocco/focus.
- Dati salvati nel browser (localStorage): `att_work_<anno>_<mese>`, `att_commesse`, `att_name`, `att_month`, `att_round`, `att_fill`, `att_gate`.
