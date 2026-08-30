// ¿Cuál conviene? Service Worker — altouch
// Subir este número cada vez que cambie el meta app-version del index.html.
const PREFIX = 'cualconviene-';
const CACHE  = PREFIX + 'v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png'
];

// ── Instalar ─────────────────────────────────────────────────────────────
// De a un archivo con su propio .catch(): si falta un ícono, se saltea ese
// y el resto entra igual. Con addAll(), un solo 404 tira abajo la instalación
// entera y el SW nunca arranca, sin avisar en ningún lado.
// Ojo: acá NO va skipWaiting(). Si ya hay una versión andando, la nueva queda
// "en espera" y la página muestra el cartel de actualizar. Recién cuando el
// usuario toca Actualizar, le mandamos el mensaje de abajo para que tome el
// control. En la primerísima instalación no hay nada esperando, así que
// arranca sola igual.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(
        ASSETS.map(url => c.add(url).catch(() => {}))
      ))
  );
});

// La página nos avisa que el usuario aceptó actualizar.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Activar ──────────────────────────────────────────────────────────────
// Borrar SOLO los caches propios. Todas las apps de altouch comparten el
// origen altouch.com.ar, así que filtrar por "distinto al mío" le vaciaría
// el cache a NMCLB, Findes y las demás.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIX) && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Solo GET.
  if (req.method !== 'GET') return;

  // Todo lo cross-origin pasa de largo sin tocar: Google Fonts, ads-config,
  // lo que sea. Un SW metiéndose con respuestas de otro origen es una fuente
  // clásica de fallos difíciles de diagnosticar.
  if (new URL(req.url).origin !== self.location.origin) return;

  // El HTML va network-first: así una corrección subida se ve enseguida.
  // Con cache-first quedaba invisible hasta desinstalar la PWA.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // El resto (íconos, manifest): cache primero, red de respaldo.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
