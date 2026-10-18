/* Attendance: rende la webapp utilizzabile anche senza rete.
   Strategia "prima la rete": se c'è connessione si usa sempre la versione più recente
   (e la si conserva); se manca, si apre l'ultima versione salvata. */
const CACHE = "attendance-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === "navigate" ? new URL("./", self.registration.scope).href : req;
    try{
      const res = await fetch(req, {cache: "no-cache"});          // ricontrolla sempre col server (304 se invariato)
      if(res.ok){
        const old = await cache.match(key);
        const tag = res.headers.get("etag"), oldTag = old && old.headers.get("etag");
        if(!old || !tag || tag !== oldTag) await cache.put(key, res.clone());
      }
      return res;
    }catch(err){
      const hit = await cache.match(key);
      if(hit) return hit;
      throw err;
    }
  })());
});
