// NMCLB Service Worker — Altouch
const CACHE = 'nmclb-v52';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

// Instalar: cachear los archivos base.
// cache:'reload' obliga a pedirlos al servidor y no al cache HTTP del navegador,
// que es lo que hacia que la version nueva no llegara nunca.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(
        ASSETS.map(u =>
          fetch(new Request(u, { cache: 'reload' }))
            .then(res => res.ok ? c.put(u, res) : null)
            .catch(() => null)
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
