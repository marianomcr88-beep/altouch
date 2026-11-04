// NMCLB Service Worker — Altouch
const CACHE   = 'nmclb-v56';
const PREFIJO = 'nmclb-';          // sólo se tocan los caches propios
const ASSETS  = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  // Tipografías propias: se bajan una vez y quedan guardadas
  './fonts/mplus-rounded-400.woff2',
  './fonts/mplus-rounded-500.woff2',
  './fonts/mplus-rounded-700.woff2',
  './fonts/mplus-rounded-800.woff2',
  './fonts/jetbrains-mono-400.woff2',
  './fonts/jetbrains-mono-600.woff2',
  './fonts/jetbrains-mono-700.woff2'
];

// Cuánto se espera a la red antes de abrir con la copia guardada.
// Sin este tope, una conexión lenta dejaba la app colgada en el splash:
// fetch() no falla, simplemente nunca contesta, así que el .catch() de
// respaldo no se disparaba jamás.
const ESPERA_HTML = 3000;

// Instalar: cachear los archivos base, de a uno y sin cortar si falla alguno.
// cache:'reload' obliga a pedirlos al servidor y no al cache HTTP del navegador.
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

// Activar: limpiar SÓLO los caches viejos de esta app.
// Todas las apps de altouch comparten el mismo origen, así que borrar todo
// le vaciaba el cache a Turno Cercano, Findes y las demás.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIJO) && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Todo lo que no sea de este dominio pasa derecho, sin tocarlo: tipografías
  // de Google, el SDK de Firebase, las APIs de cotización. El navegador las
  // maneja con su propio cache y sus propios tiempos de espera.
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  const esHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (esHTML) { e.respondWith(htmlConRespaldo(e, req)); return; }

  // Resto de archivos propios: cache primero, red como respaldo
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)));
        }
        return res;
      })
    ).catch(() => caches.match('./index.html'))
  );
});

// El HTML: red primero PERO con tope de espera, y la copia guardada como
// respaldo. Con buena señal se ve la versión nueva al instante; con mala, la
// app abre igual con lo último que tenía y la versión nueva queda cacheada
// para el próximo arranque.
async function htmlConRespaldo(e, req) {
  const cache    = await caches.open(CACHE);
  const guardado = await cache.match('./index.html');

  const red = fetch(req).then(res => {
    // Ojo: sólo se guarda una respuesta buena. Antes se cacheaba cualquier
    // cosa, así que un 404 del servidor podía quedar grabado como la app.
    if (res && res.ok) {
      const copy = res.clone();
      e.waitUntil(cache.put('./index.html', copy).catch(() => {}));
    }
    return res;
  });

  // Sin copia guardada no hay alternativa: hay que esperar a la red
  if (!guardado) {
    try { return await red; }
    catch (err) { return respuestaSinConexion(); }
  }

  const margen = new Promise(r => setTimeout(() => r(null), ESPERA_HTML));
  const res = await Promise.race([ red.catch(() => null), margen ]);
  return res || guardado;
}

function respuestaSinConexion() {
  return new Response(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>NMCLB</title></head>' +
    '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0C1A24;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px;">' +
    '<div><p style="font-size:17px;font-weight:700;margin-bottom:8px;">No se pudo abrir NMCLB</p>' +
    '<p style="font-size:14px;opacity:.65;line-height:1.5;">Revisá tu conexión y volvé a intentar.</p></div>' +
    '</body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
