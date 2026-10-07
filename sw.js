// Permite abrir la app sin conexión (por ejemplo, dentro del súper sin cobertura).
const VERSION = "v8";
const SHELL = ["./", "index.html", "styles.css", "js/app.js", "js/parser.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(`shell-${VERSION}`).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("shell-") && k !== `shell-${VERSION}`).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Código y catálogos propios: primero la red (para tener lo último), si no hay red, lo guardado.
  if (url.origin === location.origin) {
    // «no-cache» evita que el navegador sirva una versión vieja guardada por GitHub Pages.
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(`shell-${VERSION}`).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  // Fotos de productos: lo guardado primero, para que la lista cargue rápido.
  if (e.request.destination === "image") {
    e.respondWith(caches.open("fotos").then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === "opaque") c.put(e.request, res.clone());
      return res;
    }).catch(() => fetch(e.request)));
  }
});
