# findes · altoque

Cuánto te queda de vida, contado en findes, veranos y Mundiales.
Categoría **lúdica**. URL de destino: `altoque.ar/findes`.

---

## Contenido

```
findes/
├── index.html                 app completa (HTML + CSS + JS, sin dependencias)
├── manifest.json              PWA
├── sw.js                      service worker (anda offline)
├── .nojekyll                  para que GitHub Pages sirva la carpeta tal cual
├── README.md
├── fonts/                     6 archivos woff2 autohospedados
└── icons/                     PNG de la PWA + icon.svg (fuente editable)
```

Sin build, sin npm, sin backend, sin claves de API. Se sube la carpeta y funciona.

---

## Privacidad — qué garantiza y por qué

**La app no puede mandar datos a ningún lado.** No es una promesa, es una restricción técnica.
Tres capas, de arriba hacia abajo:

1. **No hay a dónde mandarlos.** No existe servidor, ni base de datos, ni cuenta de usuario,
   ni analítica, ni cookies, ni `localStorage`. La fecha se calcula en memoria y se pierde
   al cerrar la pestaña.
2. **No hay ninguna llamada externa.** Las tipografías están adentro de la carpeta. El código
   no contiene una sola URL de terceros — se puede verificar con
   `grep -rn "https://" index.html`.
3. **El navegador lo hace cumplir.** El `<meta http-equiv="Content-Security-Policy">` incluye
   `connect-src 'none'`: aunque alguien inyectara código, el navegador bloquea cualquier
   intento de conexión de salida. Y `referrer: no-referrer` evita filtrar la URL de origen.

Consecuencia legal: al no recibir ningún dato personal, no hay tratamiento de datos en los
términos de la Ley 25.326. No sos responsable de una base que no existe.

**Esto se rompe si en algún momento agregás:** Google Analytics, Google Fonts por CDN, un
píxel de Facebook, Sentry, un botón de "compartir" de una red social, o cualquier iframe.
Si algo de eso entra, hay que sacar el párrafo de privacidad de la pantalla final —
una declaración falsa es peor que no tener ninguna.

---

## Deploy en GitHub Pages

### 1. Estructura del repositorio

Un solo repo para todo el ecosistema, cada app en su subcarpeta:

```
altoque/            ← nombre del repo
├── CNAME           ← contiene una sola línea:  altoque.ar
├── index.html      ← futura home del ecosistema
└── findes/         ← esta carpeta, tal cual
```

Con eso, `altoque.ar/findes/` sirve la app. Todas las rutas internas son relativas,
así que la carpeta se puede mover o renombrar sin tocar una línea.

### 2. Publicar

En el repo: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.

Repo público alcanza y sobra. Para esta app conviene que sea público: cualquiera puede
auditar que no hay llamadas salientes, lo que respalda lo que declara la pantalla final.
(Pages sobre repo privado requiere plan pago.)

### 3. Dominio y HTTPS

En **Settings → Pages → Custom domain** poné `altoque.ar`. En tu proveedor de DNS:

| Tipo  | Nombre | Valor |
|-------|--------|-------|
| A     | @      | 185.199.108.153 |
| A     | @      | 185.199.109.153 |
| A     | @      | 185.199.110.153 |
| A     | @      | 185.199.111.153 |
| CNAME | www    | `<tu-usuario>.github.io` |

Esperá a que GitHub emita el certificado (unos minutos) y tildá **Enforce HTTPS**.
Sin HTTPS el service worker no se registra y la app no se puede instalar.

### 4. Verificar antes de anunciarla

- Abrir en el celular → tiene que aparecer el cartel de instalar (Android) o
  Compartir → "Agregar a inicio" (iOS).
- **DevTools → Network:** cargar la app y confirmar que no hay ni un pedido a un dominio
  que no sea el tuyo.
- **DevTools → Console:** que no aparezcan errores de CSP. Si el service worker se queja,
  avisame y ajustamos la directiva.
- Poner el celular en modo avión y abrir la app: tiene que funcionar completa.

### 5. En cada actualización

Subir la versión en la primera línea de `sw.js`:

```js
const V = 'findes-v2';
```

Sin eso, los usuarios siguen viendo la copia cacheada. Es el error más común con PWAs.

> GitHub Pages no deja definir headers HTTP propios, así que `sw.js` se sirve con el caché
> que decide GitHub (unos 10 minutos). Es tolerable. Si más adelante querés control real,
> Cloudflare Pages y Netlify aceptan un archivo `_headers` y son igual de gratis.

---

## Pendiente antes de publicar

**Tablas de mortalidad reales.** En `index.html`, las constantes `EX_M` y `EX_F` son valores
ilustrativos armados a mano. Reemplazar por las **tablas abreviadas de mortalidad de INDEC**,
columna `ex` (esperanza de vida restante a la edad *x*), en pasos de 5 años de 0 a 100.
Cada array tiene que quedar con 21 posiciones. Nada más cambia.

No usar esperanza de vida al nacer: `ex` es condicional a la edad y da resultados muy
distintos a partir de los 50.

---

## Ideas para la próxima versión

- **Pantalla "tus viejos":** pedir la edad de madre/padre y cuántas veces al año los ve.
  El número se acota contra la esperanza de vida *de ellos*. Es el dato más fuerte de todo
  el concepto y por eso merece pantalla propia. Por esa misma razón hoy no está entre los
  presets de "¿Cuántas veces más?": ahí el cálculo se acota contra la vida del usuario y
  daría un número alto y falso.
- **Imagen para compartir:** render en canvas de la grilla + la cifra, firmada con el símbolo
  y `altoque.ar/findes`. Hoy se comparte solo texto. Se puede hacer 100% local, sin romper
  ninguna de las tres capas de privacidad.
