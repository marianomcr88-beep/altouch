/* findes · altoque — service worker
   Subir la versión en cada deploy para forzar la actualización. */
const V = 'findes-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './fonts/rounded-400.woff2',
  './fonts/rounded-700.woff2',
  './fonts/rounded-800.woff2',
  './fonts/mono-400.woff2',
  './fonts/mono-600.woff2',
  './fonts/mono-700.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La app no pide nada fuera de su propio origen. Si algún día aparece un
  // pedido externo, acá no se atiende: se deja pasar y el CSP lo bloquea.
  if (url.origin !== location.origin) return;

  // Cache-first con refresco en segundo plano.
  e.respondWith(
    caches.match(req).then(hit => {
      const red = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(V).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
