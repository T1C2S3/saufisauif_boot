// Drink-Rad Offline-Cache. Bei Änderungen VERSION hochzählen (gleich wie APP_VERSION in index.html).
// Die App selbst (index.html) kommt immer frisch aus dem Netz, wenn es da ist, sonst aus dem Cache.
// Bilder, Manifest und Schriften kommen zuerst aus dem Cache.
const VERSION = "drinkrad-v34";
const FILES = ["./index.html", "./manifest.json", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./qrcode.js", "./jsqr.js"];
self.addEventListener("install", e => {
  // cache: "reload" umgeht den Browser-Cache, sonst landet evtl. eine alte index.html im neuen Cache
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => fetch(new Request(f, { cache: "reload" })).then(r => { if (r.ok) return c.put(f, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function fromNetwork(req, ms) {
  return new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error("timeout")), ms);
    fetch(req, { cache: "no-cache" }).then(r => { clearTimeout(t); r.ok ? ok(r) : fail(new Error(r.status)); }, err => { clearTimeout(t); fail(err); });
  });
}
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // Raum-Abgleich (Firebase) nie aus dem Cache bedienen
  if (u.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return;
  const isPage = e.request.mode === "navigate" || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname));
  if (isPage) {
    // Netz zuerst (max. 4 s, auf See ist das Netz langsam), sonst die gemerkte Version
    e.respondWith(fromNetwork("./index.html", 4000).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy));
      return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
