# Al Toque · Turno Cercano

**Encontrá la farmacia de turno más cercana en Santa Fe Capital — con mapa y ruta.**

Primera herramienta del ecosistema [Al Toque](https://altoque.netlify.app) — soluciones de bolsillo.

## Cómo funciona

1. Activás tu ubicación (o la marcás en el mapa)
2. La app consulta qué farmacias están de turno ahora mismo (scraped de El Litoral, fuente original: Colegio de Farmacéuticos 1ra Circ.)
3. Te muestra la más cercana con distancia, teléfono y ruta en el mapa
4. Podés tocar cualquier otra farmacia del listado para trazar ruta a ella

## Stack

- HTML5 / CSS3 / JavaScript vanilla
- Leaflet + OpenStreetMap (mapa)
- OSRM (ruteo por calles)
- Netlify Functions (scraper server-side de El Litoral)
- PWA instalable (manifest + service worker)

## Estructura

```
index.html                  ← App principal
kit/
  base.css                  ← Sistema de diseño Al Toque
  utils.js                  ← Utilidades compartidas
netlify/functions/
  farmacias.js              ← Scraper de El Litoral (corre en Netlify)
manifest.json / sw.js       ← PWA
farmacias-icon-*.png        ← Íconos personalizados
netlify.toml                ← Config de deploy
```

## Deploy

Conectado a Netlify. Cada push a `main` re-deploya automáticamente.
