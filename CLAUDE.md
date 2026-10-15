# Attendance app

`index.html` è una pagina d'accesso che contiene l'app vera cifrata (AES-GCM, chiave PBKDF2-SHA256 300000 iterazioni) nello `<script id="pl">`. Il codice d'accesso NON va mai scritto nel repository: chiedilo all'utente.

## Regola per ogni modifica richiesta
Ogni modifica va applicata a **entrambe** le versioni:
1. **Webapp**: il sito pubblicato dal branch `main`. Dopo aver verificato la modifica, porta i commit su `main` e fai push (oltre al branch di lavoro).
2. **App**: il file `index.html` scaricabile. Al termine invia all'utente il file `index.html` aggiornato (SendUserFile, display "attach").

## Come modificare
1. `python3 tools/decrypt.py index.html <codice> app.html` (fuori dal repo, es. nello scratchpad).
2. Modifica `app.html` (interfaccia, CSS e script principale; il modello Excel è in `TEMPLATE_B64`, le liste a tendina corrispondono al Foglio2 del modello).
3. Prova nel browser (Playwright, Chromium in /opt/pw-browsers).
4. `python3 tools/encrypt.py index.html app.html <codice> index.html` — ricifra con lo stesso codice mantenendo la pagina d'accesso.
5. Commit, push del branch e di `main`, poi invia `index.html` all'utente.
