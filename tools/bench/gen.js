// Genera screenshot di prova (con la verità nota) in stili diversi, per misurare la precisione del lettore.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const HOLD = process.argv.includes('--hold');
const TEST = process.argv.includes('--test') || HOLD;
const OUT = path.join(__dirname, HOLD ? 'img_hold' : TEST ? 'img_test' : 'img');
fs.mkdirSync(OUT, { recursive: true });

const Y = 2026, M = 10;
const GG = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
const GGL = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const wd = d => (new Date(Date.UTC(Y, M - 1, d)).getUTCDay() + 6) % 7;
const pad = n => String(n).padStart(2, '0');
const fmt = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function makeTruth(seed){
  const r = rng(seed), R = (a, b) => a + Math.floor(r() * (b - a + 1));
  const t = {};
  for(let d = 1; d <= 31; d++){
    if(wd(d) >= 5){ if(r() < 0.12) t[d] = [R(480, 540), R(720, 780)]; continue; }   // a volte si lavora di sabato
    const x = r();
    if(x < 0.08) continue;                                    // ferie: nessuna timbratura
    const a = R(445, 520), b = R(720, 765), c = R(b + 25, b + 75), e = R(990, 1085);
    if(x < 0.18) t[d] = [a, R(760, 840)];                     // mezza giornata
    else if(x < 0.27) t[d] = [a, b, c, e, R(e + 30, e + 60), R(e + 90, e + 200)];   // tre coppie
    else t[d] = [a, b, c, e];
  }
  return t;
}

const css = {
  light: { bg: '#f4f5f7', card: '#fff', ink: '#1d1d1f', mute: '#6b7280', line: '#e5e7eb', acc: '#0a7d5a' },
  dark:  { bg: '#000', card: '#1c1c1e', ink: '#f2f2f7', mute: '#8e8e93', line: '#2c2c2e', acc: '#30d158' },
};

/* A/B: app del telefono, una scheda per giorno, intervalli uno sotto l'altro, barra di stato in alto */
function appPage(truth, theme, opt = {}){
  const c = css[theme], fs = opt.fs || 17;
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [];
    const pairs = []; for(let i = 0; i < ts.length; i += 2) pairs.push(`${fmt(ts[i])} - ${fmt(ts[i + 1])}`);
    const tot = ts.length ? (ts.reduce((a, v, i) => a + (i % 2 ? v : -v), 0) / 60).toFixed(0) + ' h' : '';
    rows.push(`<div class="row" data-d="${d}"><div class="day"><div class="wd">${GG[wd(d)]}</div><div class="n">${pad(d)}</div></div>
      <div class="ts">${pairs.length ? pairs.map(p => `<div>${p}</div>`).join('') : `<div class="none">${wd(d) >= 5 ? 'Riposo' : 'Nessuna timbratura'}</div>`}</div>
      <div class="tot">${tot}</div></div>`);
  }
  return `<html><body style="margin:0;background:${c.bg};color:${c.ink};font-family:${opt.font || 'Inter'},sans-serif">
  <div id="sb" style="position:sticky;top:0;z-index:2;height:47px;display:flex;justify-content:space-between;align-items:center;padding:0 26px;font-weight:600;font-size:16px;background:${c.bg}"><span>20:41</span><span>5G ▮▮▮ 80%</span></div>
  <div style="padding:8px 16px 4px;font-size:22px;font-weight:700">Timbrature</div>
  <div style="padding:0 16px 10px;color:${c.mute};font-size:15px">Ottobre 2026</div>
  <style>.row{display:flex;align-items:center;background:${c.card};margin:0 12px 8px;border-radius:12px;padding:12px 14px;min-height:${opt.rowh || 74}px;border:1px solid ${c.line}}
  .day{width:56px;text-align:center}.wd{font-size:${fs - 4}px;color:${c.mute};font-weight:600}.n{font-size:${fs + 7}px;font-weight:700}
  .ts{flex:1;padding-left:18px;font-size:${fs}px;line-height:1.6;font-variant-numeric:tabular-nums}.none{color:${c.mute};font-size:${fs - 2}px}
  .tot{color:${c.acc};font-weight:600;font-size:${fs - 2}px}</style>
  ${rows.join('')}</body></html>`;
}

/* C: tabella da computer a colonne (stile gestionale presenze) con colonne «estranee» con orari */
function tablePage(truth, opt = {}){
  const fsz = opt.fs || 13;
  const head = ['Giorno','Turno','ING.1','USC.1','ING.2','USC.2','ING.3','USC.3','Ordinarie','Straord.','Assenze'];
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [], cells = [0,1,2,3,4,5].map(i => ts[i] != null ? fmt(ts[i]) : '');
    const worked = ts.reduce((a, v, i) => a + (i % 2 ? v : -v), 0);
    const ord = ts.length ? fmt(Math.min(480, worked)) : '', str = worked > 480 ? fmt(worked - 480) : '';
    const ass = (!ts.length && wd(d) < 5) ? 'FER 08:00' : '';
    rows.push(`<tr${wd(d) >= 5 ? ' style="background:#f3f3f3"' : ''}><td>${GG[wd(d)].toLowerCase()} ${pad(d)}</td><td>${wd(d) < 5 ? 'T01' : ''}</td>${cells.map(x => `<td>${x}</td>`).join('')}<td>${ord}</td><td>${str}</td><td>${ass}</td></tr>`);
  }
  return `<html><body style="margin:0;padding:18px;font-family:${opt.font || 'Liberation Sans'},Arial;font-size:${fsz}px;color:#222;background:#fff">
  <div style="font-size:18px;font-weight:bold;margin-bottom:10px">Cartellino presenze - Ottobre 2026</div>
  <style>table{border-collapse:collapse}td,th{border:1px solid #c8c8c8;padding:${opt.pad || 4}px 9px;text-align:center}th{background:#dfe8f3}</style>
  <table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table></body></html>`;
}

/* D: elenco su una riga per giorno: «GIO 01   8 h   07:45 - 12:30   13:00 - 16:15» */
function inlinePage(truth, opt = {}){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [];
    const pairs = []; for(let i = 0; i < ts.length; i += 2) pairs.push(`${fmt(ts[i])} - ${fmt(ts[i + 1])}`);
    const h = ts.length ? Math.round(ts.reduce((a, v, i) => a + (i % 2 ? v : -v), 0) / 60) + ' h' : '';
    rows.push(`<div style="display:flex;gap:28px;padding:7px 0;border-bottom:1px solid #eee"><span style="width:70px;font-weight:bold">${GG[wd(d)]} ${pad(d)}</span><span style="width:40px;color:#777">${h}</span>${pairs.map(p => `<span>${p}</span>`).join('')}</div>`);
  }
  return `<html><body style="margin:0;padding:20px;font-family:${opt.font || 'DejaVu Sans'};font-size:${opt.fs || 15}px;background:#fff;color:#111">
  <h3 style="margin:0 0 10px">Le mie timbrature</h3>${rows.join('')}</body></html>`;
}


/* G: tabella con data gg/mm/aaaa, Entrata/Uscita senza numero e colonna Totale */
function datesPage(truth, opt = {}){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [], cells = [0,1,2,3].map(i => ts[i] != null ? fmt(ts[i]) : '');
    const worked = ts.reduce((a, v, i) => a + (i % 2 ? v : -v), 0);
    const extra = ts.length > 4 ? `${fmt(ts[4])} ${fmt(ts[5])}` : '';
    rows.push(`<tr><td>${pad(d)}/10/2026</td><td>${GGL[wd(d)]}</td>${cells.map(x => `<td>${x}</td>`).join('')}<td>${extra}</td><td><b>${ts.length ? fmt(worked) : ''}</b></td></tr>`);
  }
  return `<html><body style="margin:0;padding:14px;font-family:Carlito,Calibri;font-size:${opt.fs || 14}px;background:#fff;color:#000">
  <style>td,th{padding:5px 12px;border-bottom:1px solid #ddd;text-align:left}th{color:#555}</style>
  <table><tr><th>Data</th><th>Giorno</th><th>Entrata</th><th>Uscita</th><th>Entrata</th><th>Uscita</th><th>Altre</th><th>Totale</th></tr>${rows.join('')}</table></body></html>`;
}
/* H: orari separati da spazi, senza trattino */
function spacesPage(truth){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [];
    rows.push(`<div style="display:flex;gap:20px;padding:9px 12px;border-bottom:1px solid #e5e5e5"><b style="width:74px">${GG[wd(d)]} ${pad(d)}</b><span style="letter-spacing:.5px;word-spacing:14px">${ts.map(fmt).join(' ')}</span></div>`);
  }
  return `<html><body style="margin:0;font-family:Inter;font-size:16px;background:#fff">${rows.join('')}</body></html>`;
}
/* L: ogni timbratura su una riga «Entrata 07:46» / «Uscita 12:31» */
function punchesPage(truth, theme){
  const c = css[theme];
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [];
    rows.push(`<div style="display:flex;padding:10px 16px;border-bottom:1px solid ${c.line};background:${c.card}"><div style="width:64px;text-align:center"><div style="font-size:13px;color:${c.mute}">${GG[wd(d)]}</div><div style="font-size:24px;font-weight:700">${pad(d)}</div></div>
      <div style="flex:1;padding-left:14px;font-size:16px;line-height:1.7">${ts.length ? ts.map((v, i) => `<div><span style="color:${i % 2 ? '#c0392b' : '#1e8449'}">${i % 2 ? '▲ Uscita' : '▼ Entrata'}</span>&nbsp;&nbsp;${fmt(v)}</div>`).join('') : `<span style="color:${c.mute}">—</span>`}</div></div>`);
  }
  return `<html><body style="margin:0;background:${c.bg};color:${c.ink};font-family:Inter">
  <div style="position:sticky;top:0;height:47px;display:flex;justify-content:space-between;align-items:center;padding:0 26px;font-weight:600;background:${c.bg}"><span>9:05</span><span>4G 63%</span></div>${rows.join('')}</body></html>`;
}
async function degrade(b, files, scale, q, name){
  const out = [];
  for(const [i, f] of files.entries()){
    const p = await b.newPage();
    const data = fs.readFileSync(f).toString('base64');
    const jpg = await p.evaluate(async ([src, scale, q]) => {
      const im = new Image(); im.src = src; await im.decode();
      const cv = document.createElement('canvas'); cv.width = Math.round(im.width * scale); cv.height = Math.round(im.height * scale);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      return cv.toDataURL('image/jpeg', q).split(',')[1];
    }, ['data:image/png;base64,' + data, scale, q]);
    const nf = `${name}_${i}.jpg`;
    fs.writeFileSync(path.join(OUT, nf), Buffer.from(jpg, 'base64')); fs.unlinkSync(f); out.push(nf);
    await p.close();
  }
  return out;
}


/* M: app con frecce «07:45 → 12:30», carattere diverso */
function arrowPage(truth){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || []; const pairs = []; for(let i = 0; i < ts.length; i += 2) pairs.push(`${fmt(ts[i])} → ${fmt(ts[i + 1])}`);
    rows.push(`<div style="display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid #ddd"><div style="width:60px"><div style="font-size:12px;color:#888">${GG[wd(d)]}</div><div style="font-size:22px">${d}</div></div><div style="font-size:16px;line-height:1.6">${pairs.map(p => `<div>${p}</div>`).join('') || '<div style="color:#aaa">—</div>'}</div></div>`);
  }
  return `<html><body style="margin:0;font-family:'Liberation Sans';background:#fafafa;color:#222"><div style="height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-weight:600"><span>11:58</span><span>WiFi 92%</span></div>${rows.join('')}</body></html>`;
}
/* N: tabella «1 gio | IN1 OUT1 IN2 OUT2 | Ore» */
function inoutPage(truth){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || [], cells = [0,1,2,3,4,5].map(i => ts[i] != null ? fmt(ts[i]) : '');
    const worked = ts.reduce((a, v, i) => a + (i % 2 ? v : -v), 0);
    rows.push(`<tr><td>${d} ${GG[wd(d)].toLowerCase()}</td>${cells.map(x => `<td>${x}</td>`).join('')}<td>${ts.length ? fmt(worked) : ''}</td></tr>`);
  }
  return `<html><body style="margin:0;padding:12px;font-family:'DejaVu Sans';font-size:13px;background:#fff"><style>td,th{padding:4px 10px;border:1px solid #bbb;text-align:center}</style>
  <table><tr><th>Giorno</th><th>IN1</th><th>OUT1</th><th>IN2</th><th>OUT2</th><th>IN3</th><th>OUT3</th><th>Ore</th></tr>${rows.join('')}</table></body></html>`;
}
/* O: elenco scuro «Gio 1» con trattino lungo */
function endashPage(truth){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || []; const pairs = []; for(let i = 0; i < ts.length; i += 2) pairs.push(`${fmt(ts[i])} – ${fmt(ts[i + 1])}`);
    const g = GG[wd(d)]; rows.push(`<div style="display:flex;gap:24px;padding:11px 16px;border-bottom:1px solid #333"><span style="width:62px;color:#9aa">${g[0] + g.slice(1).toLowerCase()} ${d}</span><span>${pairs.join('&nbsp;&nbsp;&nbsp;&nbsp;') || '<span style="color:#666">riposo</span>'}</span></div>`);
  }
  return `<html><body style="margin:0;font-family:Inter;font-size:15px;background:#121212;color:#eee">${rows.join('')}</body></html>`;
}
/* R: giorno per esteso «Giovedì 1 ottobre» e orari sotto */
function longdayPage(truth){
  const rows = [];
  for(let d = 1; d <= 31; d++){
    const ts = truth[d] || []; const pairs = []; for(let i = 0; i < ts.length; i += 2) pairs.push(`${fmt(ts[i])} - ${fmt(ts[i + 1])}`);
    rows.push(`<div style="padding:12px 18px;border-bottom:1px solid #e3e3e3"><div style="font-weight:700;font-size:16px">${GGL[wd(d)]} ${d} ottobre</div><div style="font-size:15px;color:#333;margin-top:4px">${pairs.join(' &nbsp;·&nbsp; ') || 'Nessuna timbratura'}</div></div>`);
  }
  return `<html><body style="margin:0;font-family:'Liberation Sans';background:#fff"><div style="height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-weight:600"><span>8:15</span><span>87%</span></div>${rows.join('')}</body></html>`;
}

async function shoot(b, html, vp, dpr, name, opt = {}){
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: dpr });
  await p.setContent(html);
  const files = [];
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  if(opt.scroll){                                               // più screenshot scorrendo, come sul telefono
    let y = 0, k = 0;
    while(true){
      await p.evaluate(v => window.scrollTo(0, v), y);
      const f = path.join(OUT, `${name}_${k}.png`);
      await p.screenshot({ path: f });
      files.push(f); k++;
      if(y + vp.height >= total) break;
      y += Math.round(vp.height * 0.78);
    }
  } else {
    const f = path.join(OUT, `${name}_0.png`);
    await p.screenshot({ path: f, fullPage: true }); files.push(f);
  }
  await p.close();
  return files;
}

(async () => {
  const b = await chromium.launch();
  const sets = [];
  const add = async (name, seed, html, vp, dpr, opt) => {
    const truth = makeTruth(HOLD ? seed * 13 + 5 : TEST ? seed * 7 + 3 : seed);
    if(HOLD && vp.width < 500) vp = {width: vp.width + 24, height: vp.height + 60};
    const files = await shoot(b, html(truth), vp, dpr, name, opt);
    sets.push({ name, truth, files: files.map(f => path.basename(f)) });
  };
  await add('A_app_chiaro', 11, t => appPage(t, 'light'), { width: 390, height: 844 }, 3, { scroll: true });
  await add('B_app_scuro', 22, t => appPage(t, 'dark'), { width: 390, height: 844 }, 3, { scroll: true });
  await add('C_tabella_pc', 33, t => tablePage(t), { width: 1366, height: 768 }, 1, { scroll: true });
  await add('D_elenco_riga', 44, t => inlinePage(t), { width: 900, height: 900 }, 1, { scroll: true });
  await add('F_app_piccolo', 66, t => appPage(t, 'light', { fs: 14, rowh: 56, font: 'Liberation Sans' }), { width: 375, height: 667 }, 2, { scroll: true });

  await add('G_date_tabella', 77, t => datesPage(t), { width: 1100, height: 800 }, 1, { scroll: true });
  await add('H_spazi', 88, t => spacesPage(t), { width: 600, height: 800 }, 1.5, { scroll: true });
  await add('I_pc_minuscolo', 99, t => tablePage(t, { fs: 11, pad: 2, font: 'DejaVu Sans' }), { width: 1280, height: 720 }, 1, { scroll: true });
  await add('K_tabella_scura', 111, t => tablePage(t).replace('background:#fff', 'background:#1e1e1e').replace('color:#222', 'color:#ddd').replace('th{background:#dfe8f3}', 'th{background:#2d3748}').replace(/background:#f3f3f3/g, 'background:#262626').replace('#c8c8c8', '#444'), { width: 1366, height: 768 }, 1, { scroll: true });
  await add('L_entrata_uscita', 122, t => punchesPage(t, 'light'), { width: 390, height: 844 }, 3, { scroll: true });
  const tX = makeTruth(HOLD ? 13333 : TEST ? 1333 : 133);
  const rawX = await shoot(b, appPage(tX, 'dark'), { width: 390, height: 844 }, 3, 'X_tmp', { scroll: true });
  sets.push({ name: 'X_molto_compresso', truth: tX, files: await degrade(b, rawX, 0.38, 0.3, 'X_molto_compresso') });
  // E: come A ma inoltrato su WhatsApp (rimpicciolito e compresso)
  if(TEST){
    await add('M_frecce', 201, t => arrowPage(t), { width: 412, height: 915 }, 2.6, { scroll: true });
    await add('N_in_out', 202, t => inoutPage(t), { width: 1200, height: 760 }, 1, { scroll: true });
    await add('O_trattino_lungo', 203, t => endashPage(t), { width: 700, height: 900 }, 1.25, { scroll: true });
    await add('R_giorno_esteso', 204, t => longdayPage(t), { width: 390, height: 844 }, 3, { scroll: true });
    const tP = makeTruth(HOLD ? 2055 : 205);
    const rawP = await shoot(b, tablePage(tP), { width: 1366, height: 768 }, 1, 'P_tmp', { scroll: true });
    sets.push({ name: 'P_tabella_whatsapp', truth: tP, files: await degrade(b, rawP, 0.6, 0.5, 'P_tabella_whatsapp') });
  }
  const tE = makeTruth(HOLD ? 5555 : TEST ? 555 : 55);
  const raw = await shoot(b, appPage(tE, 'light'), { width: 390, height: 844 }, 3, 'E_tmp', { scroll: true });
  const eFiles = [];
  for(const [i, f] of raw.entries()){
    const p = await b.newPage();
    const data = fs.readFileSync(f).toString('base64');
    const jpg = await p.evaluate(async src => {
      const im = new Image(); im.src = src; await im.decode();
      const cv = document.createElement('canvas'); cv.width = Math.round(im.width * 0.55); cv.height = Math.round(im.height * 0.55);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      return cv.toDataURL('image/jpeg', 0.45).split(',')[1];
    }, 'data:image/png;base64,' + data);
    const nf = `E_whatsapp_${i}.jpg`;
    fs.writeFileSync(path.join(OUT, nf), Buffer.from(jpg, 'base64')); fs.unlinkSync(f); eFiles.push(nf);
    await p.close();
  }
  sets.push({ name: 'E_whatsapp', truth: tE, files: eFiles });
  fs.writeFileSync(path.join(__dirname, HOLD ? 'truth_hold.json' : TEST ? 'truth_test.json' : 'truth.json'), JSON.stringify(sets, null, 1));
  console.log(sets.map(s => `${s.name}: ${s.files.length} immagini, ${Object.keys(s.truth).length} giorni con orari`).join('\n'));
  await b.close();
})();
