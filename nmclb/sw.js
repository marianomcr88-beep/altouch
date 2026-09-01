// NMCLB Service Worker — Altouch
const CACHE = 'nmclb-v47';
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
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = req.url;

  if (req.method !== 'GET') return;

  // Las llamadas a la API de cotizacion siempre van a la red
  if (url.includes('dolarapi.com') || url.includes('coingecko.com') || url.includes('firebaseio.com')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // El HTML: red primero, cache como respaldo.
  // Asi una version nueva se ve apenas se sube, sin esperar a que expire nada.
  const esHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (esHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Iconos, manifest y demas: cache primero, red como respaldo
  e.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
