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
- Passo 3: unico metodo di compilazione multipla è il modulo per intervallo (`#btnQuick`: quali giorni, dal/al, attività, commessa, viaggio/navigazione + ore). Le ore compaiono solo dopo aver scelto VIAGGIO («Ore viaggio», colonna Y) o NAVIGAZIONE («Ore navigazione», colonna Z); stessa regola nei dettagli «Altro» di ogni giorno.
- Firma: all'export il nome del tecnico va in AB43 (casella «Tecnico intervenuto», unita ad AB44) con le maiuscole di una firma (`sigName`), usando il carattere da firma già previsto dal modello (Edwardian Script ITC 28 grassetto) con «riduci per adattare»; anteprima al passo 4.
- Lettura screenshot (core): `ocrShot` = Tesseract (PSM 11) + `refineWords` (riletture mirate a cifre e «:» delle righe sospette, terza lettura a maggioranza se disaccordo); `parseWordsGeo` ancora i giorni (data scritta, oppure giorno della settimana + numero accanto/sotto) e assegna gli orari per colonne con intestazioni (ignora Totale/Ordinarie/Assenze…), per etichette Entrata/Uscita, per coppie «ora - ora» o come serie crescente; `parseBatch` unisce più screenshot (schema colonne condiviso, per casella vince la lettura più sicura). Regola: meglio una casella vuota (segnalata «Orario incompleto») che un orario sbagliato.
- Misurare la precisione del lettore: `tools/bench/gen.js [--test|--hold]` genera screenshot di prova con la verità nota (17 stili), `tools/bench/eval.js <app.html> [--test|--hold] [--v]` li fa leggere all'app (servita via http su 127.0.0.1:8765 insieme alla cartella `bench/`) e riporta orari giusti/sbagliati/mancanti. Riferimento attuale: train 100%, test 99,9% (0 sbagliati), hold 99,4% (1 sbagliato su 1442); il lettore precedente faceva 71,1% sul hold.
- Design e accessibilità (WCAG 2.1 AA, verificato con axe-core: 0 violazioni): testi ≥ 4,5:1 e bordi dei campi ≥ 3:1 (token `--mute`, `--field-b`, colori di stato scuriti); su schermi touch tutti i comandi ≥ 44 px (`@media (pointer: coarse)`); focus visibile 2 px (`--focus`); al cambio di passo il focus va al titolo (h2 tabindex=-1); `prefers-reduced-motion` rispettato. Conferme sempre con `askConfirm()` (finestra dell'app, pulsanti che dicono l'azione), mai `confirm()` del browser. Un'unica azione principale per schermata, nella barra in basso («Avanti: <passo>», al passo 4 «Scarica Excel»); passi 1, 2, 4 in colonna da 760 px, passo 3 largo.
- «Ripristina <mese>» (passo 1, `#btnReset`) e «Ripristina il mese» (passo 3, `#btnClearTimes`) chiamano `resetMonth()`: svuotano solo i giorni del mese aperto (orari, attività, commesse assegnate, note) e gli screenshot; commesse salvate, scelte e altri mesi restano. Conferma con `askConfirm`, annullabile.
- Tendine: tutte le celle compilabili usano le liste del Foglio2; per velocità le tendine della tabella nascono "pigre" (`data-lazy`) e ricevono l'elenco completo al primo tocco/focus.
- L'interfaccia è divisa in 4 schermate (Chi sei · Timbrature · Giorni · Scarica): `goStep(n)`, barra `#stepper`, pulsanti `#btnBack`/`#btnNext`; il tasto indietro del browser torna al passo precedente (history `#passo-n`). Senza nome non si va oltre il passo 1.
- Dati per persona (nome tecnico, così i colleghi sullo stesso dispositivo non vedono i dati altrui), in localStorage: `att_work__<NOME>_<anno>_<mese>`, `att_commesse__<NOME>`, `att_fill__<NOME>` (ultime scelte del modulo «Compila più giorni insieme»). Comuni: `att_name` (ultima persona), `att_month`, `att_round`, `att_gate`, `att_v2` (migrazione fatta: i vecchi `att_work_<a>_<m>`, `att_commesse`, `att_fill` sono stati assegnati alla persona salvata, o a ROBERTO NANNIPIERI che era il predefinito).
