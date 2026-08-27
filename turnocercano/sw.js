// ============================================================================
// Service Worker — turno cercano · altouch
// Versión 1.4.0
//
// Al subir de versión hay que tocar los 3 lugares a la vez:
//   1. <meta name="app-version"> en index.html
//   2. const APP_VERSION en index.html
//   3. CACHE_NAME acá abajo
// Si no, el navegador sigue sirviendo la versión vieja desde el cache.
// ============================================================================

const CACHE_NAME = "turnocercano-v1.4.0";
const PREFIJO = "turnocercano-";

// Nombres de cache de versiones anteriores que no arrancan con el prefijo
// actual. Sin esto quedan huérfanos para siempre, ocupando espacio.
const CACHES_VIEJOS = ["turno-cercano-v2", "turno-cercano-v1"];
// (turnocercano-v1.2.0 y anteriores ya los cubre el prefijo)

// Rutas relativas: la app vive en altouch.com.ar/turnocercano/, no en la raíz.
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./farmacias-icon-192.png",
  "./farmacias-icon-512.png",
  "./farmacias-maskable-512.png",
  "./farmacias-favicon-64.png",
  "./farmacias-apple-touch.png",
];

// ---------------------------------------------------------------------------
// Install: precachea los assets base.
// Se cachea uno por uno en vez de addAll() porque addAll() es todo o nada:
// si falta un solo ícono, falla la instalación entera y el SW nunca arranca.
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

// ---------------------------------------------------------------------------
// Activate: borra los caches de versiones anteriores y toma control ya.
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      // IMPORTANTE: filtrar por prefijo propio. Todas las apps de altouch
      // comparten el mismo origen (altouch.com.ar), así que borrar "todo lo
      // que no sea mi cache" le vacía el cache a NMCLB, Findes y las demás.
      await Promise.all(
        nombres
          .filter(
            (n) =>
              (n.startsWith(PREFIJO) || CACHES_VIEJOS.includes(n)) &&
              n !== CACHE_NAME
          )
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Fetch
//
// Dos reglas importantes:
//
// 1. TODO lo que no sea del mismo origen se deja pasar sin tocar: la función
//    de Netlify, los tiles de OpenStreetMap, OSRM, Google Fonts y el CDN de
//    Leaflet. Un service worker que intenta cachear respuestas cross-origin
//    es una fuente clásica de fallos difíciles de diagnosticar, y acá el dato
//    del turno tiene que venir fresco sí o sí.
//
// 2. El HTML va network-first. La identidad de altouch dice cache-first, pero
//    para esta app conviene la excepción: con cache-first, cada corrección que
//    subís queda invisible hasta que el usuario desinstala la PWA. Con
//    network-first, si hay red ve la última versión, y si no hay red ve la
//    cacheada. El resto (íconos, manifest) sí va cache-first.
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ← regla 1

  const esNavegacion =
    req.mode === "navigate" || req.destination === "document";

  if (esNavegacion) {
    // Network-first con fallback al cache.
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          if (resp && resp.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put("./index.html", resp.clone()).catch(() => {});
          }
          return resp;
        } catch (e) {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            new Response(
              "<h1>Sin conexión</h1><p>Abrí la app cuando tengas señal.</p>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
          );
        }
      })()
    );
    return;
  }

  // Resto de assets propios: cache-first con fallback a red.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cacheado = await cache.match(req);
      if (cacheado) return cacheado;
      try {
        const resp = await fetch(req);
        if (resp && resp.ok && resp.type === "basic") {
          cache.put(req, resp.clone()).catch(() => {});
        }
        return resp;
      } catch (e) {
        return new Response("", { status: 504, statusText: "Sin conexión" });
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// Permite forzar la actualización desde la página si alguna vez hace falta:
// navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'})
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
