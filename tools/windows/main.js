// Attendance per Windows: la stessa app del sito, tutta in locale e utilizzabile senza internet.
// La pagina è servita da app://attendance (origine fissa: i dati salvati restano tra un avvio e l'altro).
// Con internet controlla il sito: se c'è una versione nuova la scarica e propone di riavviare.
const { app, BrowserWindow, protocol, net, session, shell, dialog, Menu } = require("electron");
const path = require("path"), fs = require("fs"), crypto = require("crypto");

const SITE = process.env.ATT_UPDATE_URL || "https://attendance-app-it.netlify.app/index.html";
const BUNDLED = path.join(__dirname, "www");
app.setName("Attendance");
if (process.env.ATT_USERDATA) app.setPath("userData", process.env.ATT_USERDATA);
const UPD = () => path.join(app.getPath("userData"), "aggiornamento");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

const TYPES = { html: "text/html; charset=utf-8", png: "image/png", js: "text/javascript", webmanifest: "application/manifest+json", ico: "image/x-icon" };
function fileFor(name){
  if (name === "index.html"){ const u = path.join(UPD(), "index.html"); if (fs.existsSync(u)) return u; }
  return path.join(BUNDLED, name);
}
// un aggiornamento scaricato con una versione precedente del programma non vale più dopo una nuova installazione
function dropStaleUpdate(){
  try{
    const v = path.join(UPD(), "programma.txt");
    if (fs.existsSync(UPD()) && (!fs.existsSync(v) || fs.readFileSync(v, "utf8") !== app.getVersion())) fs.rmSync(UPD(), { recursive: true, force: true });
  }catch(e){}
}
const sha1 = b => crypto.createHash("sha1").update(b).digest("hex");

async function checkUpdate(win){
  if (process.env.ATT_NO_UPDATE) return;
  try{
    const r = await net.fetch(SITE + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100000 || !buf.includes('id="pl"')) return;            // non è la pagina dell'app
    if (sha1(buf) === sha1(fs.readFileSync(fileFor("index.html")))) return; // già aggiornato
    fs.mkdirSync(UPD(), { recursive: true });
    fs.writeFileSync(path.join(UPD(), "index.html.tmp"), buf);
    fs.renameSync(path.join(UPD(), "index.html.tmp"), path.join(UPD(), "index.html"));
    fs.writeFileSync(path.join(UPD(), "programma.txt"), app.getVersion());
    if (process.env.ATT_TEST){ console.log("ATT_UPDATE_SAVED"); return; }
    const { response } = await dialog.showMessageBox(win, { type: "info", buttons: ["Riavvia ora", "Più tardi"], defaultId: 0, cancelId: 1,
      title: "Aggiornamento", message: "È pronta una nuova versione di Attendance.", detail: "Riavvia per usarla. I tuoi dati restano dove sono." });
    if (response === 0){ app.relaunch(); app.exit(0); }
  }catch(e){ /* senza internet: si usa la versione già presente */ }
}

app.whenReady().then(() => {
  dropStaleUpdate();
  protocol.handle("app", req => {
    let name = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, "")) || "index.html";
    if (name.includes("..") || name.includes("\\")) return new Response("", { status: 400 });
    const f = fileFor(name);
    if (!fs.existsSync(f)) return new Response("", { status: 404 });
    return new Response(fs.readFileSync(f), { headers: { "content-type": TYPES[name.split(".").pop()] || "application/octet-stream" } });
  });
  Menu.setApplicationMenu(null);
  session.defaultSession.on("will-download", (e, item) => {
    if (process.env.ATT_TEST_DOWNLOAD_DIR){ item.setSavePath(path.join(process.env.ATT_TEST_DOWNLOAD_DIR, item.getFilename())); return; }
    item.setSaveDialogOptions({ title: "Salva il file Excel", defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
      filters: [{ name: "File Excel", extensions: ["xlsx"] }] });
  });
  const win = new BrowserWindow({ width: 1280, height: 860, minWidth: 380, minHeight: 560, title: "Attendance",
    icon: path.join(BUNDLED, "icon-512.png"), backgroundColor: "#f3f4f7", autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("app://")){ e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadURL("app://attendance/index.html");
  setTimeout(() => checkUpdate(win), 5000);
});
app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w){ if (w.isMinimized()) w.restore(); w.focus(); } });
app.on("window-all-closed", () => app.quit());
