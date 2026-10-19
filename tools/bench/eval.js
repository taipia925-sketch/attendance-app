// Misura la precisione del lettore di screenshot dell'app sugli screenshot di prova.
// uso: node eval.js [app.html] [--only=A,C] [--reuse]   (--reuse: riusa le parole OCR salvate, prova solo l'analisi)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const appFile = args.find(a => !a.startsWith('--')) || 'new_app.html';
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const reuse = args.includes('--reuse');
const HOLD = args.includes('--hold');
const TEST = args.includes('--test') || HOLD;
const sets = JSON.parse(fs.readFileSync(path.join(__dirname, HOLD ? 'truth_hold.json' : TEST ? 'truth_test.json' : 'truth.json'))).filter(s => !only.length || only.some(o => s.name.startsWith(o)));
const CACHE = path.join(__dirname, 'ocr_cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE)) : {};
const fmt = m => m == null ? '--:--' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/' + appFile);
  await p.evaluate(() => { setPerson('MARCO LUIGI CALATI'); setMonth(2026, 10); });
  const tot = {days:0, exact:0, ok:0, wrong:0, miss:0, extra:0, falseDays:0, secs:0};
  const rows = [];
  for(const s of sets){
    const per = [];
    for(const f of s.files){
      const key = (process.env.OCRKEY || appFile) + '|' + (HOLD ? 'hold/' : TEST ? 'test/' : 'train/') + f;
      let r = reuse ? cache[key] : null;
      if(!r){
        const t0 = Date.now();
        r = await p.evaluate(async url => {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], url.split('/').pop(), {type: blob.type});
          const res = window.ocrForBench ? await window.ocrForBench(file) : await (async () => { const {data, W, H} = await ocrFile(file, null); return {words: wordsFromTess(data), W, H}; })();
          return res;
        }, 'http://127.0.0.1:8765/bench/' + (HOLD ? 'img_hold/' : TEST ? 'img_test/' : 'img/') + f);
        r.secs = (Date.now() - t0) / 1000; cache[key] = r;
      }
      tot.secs += r.secs || 0;
      per.push(r);
    }
    const found = await p.evaluate(per => {
      if(window.parseBatch) return parseBatch(per, 2026, 10).merged;
      const merged = {};
      per.forEach(r => { const q = parseWordsGeo(r.words, r.W, r.H, 2026, 10); Object.keys(q.found).forEach(k => { if(!merged[k] || q.found[k].length >= merged[k].length) merged[k] = q.found[k]; }); });
      return merged;
    }, per);
    const st = {days:0, exact:0, ok:0, wrong:0, miss:0, extra:0, falseDays:0};
    const bad = [];
    for(let d = 1; d <= 31; d++){
      const tr = s.truth[d] || [], fo = (found[d] || []).filter(v => v != null);
      if(!tr.length){ if(fo.length){ st.falseDays++; st.extra += fo.length; bad.push(`  giorno ${d}: atteso nulla, letto ${fo.map(fmt).join(' ')}`); } continue; }
      st.days++;
      const slots = (found[d] || []);
      let exact = true;
      tr.forEach((v, i) => { const g = slots[i]; if(g == null) { st.miss++; exact = false; } else if(g === v) st.ok++; else { st.wrong++; exact = false; } });
      for(let i = tr.length; i < slots.length; i++) if(slots[i] != null){ st.extra++; exact = false; }
      if(exact) st.exact++;
      else bad.push(`  giorno ${d}: atteso ${tr.map(fmt).join(' ')} | letto ${slots.map(fmt).join(' ')}`);
    }
    Object.keys(st).forEach(k => tot[k] += st[k]);
    const nt = st.ok + st.wrong + st.miss;
    rows.push(`${s.name.padEnd(15)} giorni esatti ${String(st.exact).padStart(2)}/${st.days}  orari giusti ${st.ok}/${nt}  sbagliati ${st.wrong}  mancanti ${st.miss}  in più ${st.extra}  giorni inventati ${st.falseDays}`);
    if(args.includes('--v')) rows.push(...bad);
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  console.log(rows.join('\n'));
  const nt = tot.ok + tot.wrong + tot.miss;
  console.log(`TOTALE          giorni esatti ${tot.exact}/${tot.days} (${(100 * tot.exact / tot.days).toFixed(1)}%)  orari giusti ${tot.ok}/${nt} (${(100 * tot.ok / nt).toFixed(1)}%)  sbagliati ${tot.wrong}  mancanti ${tot.miss}  in più ${tot.extra}  giorni inventati ${tot.falseDays}  | OCR ${tot.secs.toFixed(1)} s`);
  if(errs.length) console.log('errori pagina:', errs);
  await b.close();
})();
