const CACHE = "turno-cercano-v2";
const SHELL = ["/", "/index.html", "/manifest.json", "/farmacias-icon-192.png", "/farmacias-icon-512.png", "/kit/base.css", "/kit/utils.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // La función de farmacias y cualquier llamada externa (mapas, geocoding)
  // siempre van a la red: nunca queremos servir un turno viejo desde caché.
  if (url.pathname.startsWith("/.netlify/functions/") || url.origin !== location.origin) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
