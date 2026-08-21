// NMCLB Service Worker — Altouch
const CACHE = 'nmclb-v33';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];
 
// Instalar: cachear los archivos base
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(()=>{}))
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
