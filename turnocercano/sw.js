// ¿Cuál conviene? Service Worker — altouch
// La versión tiene que coincidir con <meta name="app-version"> del index.
const APP_VERSION = 3;
const CACHE = 'cualconviene-v' + APP_VERSION;
const FONTS = 'cualconviene-fonts';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png'
];

// Instalar: cachear los archivos base.
// Uno por uno: si falta un ícono, se cachea el resto igual
// (addAll es todo-o-nada y fallaría en silencio).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos (menos el de fuentes, que no cambia)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts: cache-first en su propio cache, para que ande offline.
  // Son respuestas opacas (status 0), así que no se puede mirar res.ok.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => {
          c.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => hit))
      )
    );
    return;
  }

  // Cualquier otro dominio (ads-config.json en la raíz, etc.): no lo tocamos
  if (url.origin !== self.location.origin) return;

  // El HTML va a la red primero: así una versión nueva se ve al toque
  // en vez de quedar servida del cache hasta el próximo cambio de versión.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Resto de assets propios: cache primero, red de respaldo
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
    ).catch(() => undefined)
  );
});
