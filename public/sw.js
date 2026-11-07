// Service worker dell'app LPS: rende l'app installabile e utilizzabile anche senza rete
// per le parti già aperte. Pagine: prima la rete, poi la copia salvata. File con hash (assets): copia salvata.
const CACHE = "lps-v1";
const BASE = new URL("./", self.location).pathname;
const ESSENZIALI = ["./", "./manifest.webmanifest", "./icona-192.png", "./icona.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENZIALI)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(BASE, copia)); }
      return r;
    }).catch(() => caches.match(BASE)));
    return;
  }
  if (url.pathname.startsWith(BASE + "assets/")) {
    e.respondWith(caches.match(req).then((salvato) => salvato || fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    })));
    return;
  }
  // altri file (dati, icone, wasm): rete, con copia di riserva
  e.respondWith(fetch(req).then((r) => {
    if (r.ok && !url.pathname.endsWith(".pdf")) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req).then((s) => s || Response.error())));
});
