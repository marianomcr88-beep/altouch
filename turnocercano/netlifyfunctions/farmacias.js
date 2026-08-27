// ============================================================================
// Netlify Function: /.netlify/functions/farmacias
//
// Lee el HTML público de El Litoral (que reproduce el cronograma oficial del
// Colegio de Farmacéuticos de Santa Fe 1ra Circunscripción) y devuelve las
// farmacias del turno VIGENTE en este momento, con coordenadas.
//
// CAMBIOS RESPECTO DE LA VERSIÓN ANTERIOR (27/ago/2026)
// 1. ENCODING: la página se sirve en ISO-8859-1. Antes se leía con
//    resp.text() (que asume UTF-8) y todo lo acentuado llegaba roto
//    ("San Jer?nimo"), así que no matcheaba con KNOWN_COORDS. Ahora se
//    decodifica bien y, además, las claves se normalizan sin acentos para
//    que un problema de encoding nunca más rompa el matcheo.
// 2. DOS TURNOS: la página publica el turno vigente Y el que arranca a las
//    8:00 del día siguiente. El regex agarraba los dos y los mezclaba.
//    Ahora se separan y se elige el que corresponde según la hora argentina.
// 3. GEOCODING: si una farmacia no está en KNOWN_COORDS, se busca en
//    Nominatim (OpenStreetMap) en el momento. Con límite por corrida para
//    no pasarse del timeout de Netlify ni abusar del servicio.
// 4. TELÉFONOS: El Litoral ahora devuelve "0342 - 4894243 / 4894287".
//    Se agrega el campo `tel` ya normalizado a formato marcable.
// 5. Las farmacias sin coordenadas ya no desaparecen: van en `unlocated`
//    para que el front-end pueda listarlas (sin distancia) en vez de mentir.
// ============================================================================

const SOURCE_URL = "https://servicios.ellitoral.com/seccion/farmacias/";
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Argentina es UTC-3 todo el año (no hay horario de verano).
const AR_OFFSET_H = 3;

// Presupuestos para no pasarse del timeout de Netlify (10 s por defecto).
const MAX_GEOCODE_POR_CORRIDA = 6;
const PRESUPUESTO_GEOCODE_MS = 6000;
const DELAY_NOMINATIM_MS = 1100; // política de uso: máx. 1 request/segundo
const MEMO_TTL_MS = 4 * 60 * 1000;

// Contacto obligatorio en el User-Agent según la política de Nominatim.
const UA = "TurnoCercano/1.1 (altouch.com.ar; altoquesolucionesdebolsillo@gmail.com)";

// Caja aproximada de Santa Fe capital: lon,lat,lon,lat
const VIEWBOX = "-60.82,-31.54,-60.60,-31.73";
const BBOX = { latMin: -31.73, latMax: -31.54, lonMin: -60.82, lonMax: -60.60 };

// ---------------------------------------------------------------------------
// Tabla base de coordenadas (caché manual). Ya no es la única fuente: lo que
// falte se geocodifica solo. Sirve como respaldo si Nominatim falla.
// clave = "nombre|dirección" tal como aparece en El Litoral.
// ---------------------------------------------------------------------------
const KNOWN_COORDS = {
  "acosta|suipacha 2506": [-31.6401411, -60.7040322],
  "alejandro senn|4 de enero 2599": [-31.6445548, -60.7114968],
  "bonazzola denise|gral. lópez 2740": [-31.6566039, -60.7113468],
  "chelini|av. facundo zuviría 4679": [-31.6237060, -60.7055044],
  "giulioni|gorostiaga 3038": [-31.6105016, -60.7021046],
  "lópez|av. lópez y planes 4267": [-31.6257108, -60.7139182],
  "mai|av. aristóbulo del valle 7431": [-31.5998761, -60.6920943],
  "martínez juan josé|av. urquiza 1859": [-31.6529940, -60.7153790],
  "méndez|güemes 4356": [-31.6307547, -60.6866912],
  "naito|mendoza 4098": [-31.6440716, -60.7265361],
  "pasteur|marcial candioti 3499": [-31.6373787, -60.6956182],
  "rojas|blas parera 7202": [-31.5952663, -60.7229344],
  "valetti|av. gral. paz 6440": [-31.6122221, -60.6793931],
  "caporizzo|av. aristóbulo del valle 9284": [-31.5820362, -60.6895607],
  "capra|entre ríos 3115": [-31.6590711, -60.7174737],
  "costa samita|av. aristóbulo del valle 6378": [-31.6097253, -60.6939748],
  "donadío|javier de la rosa 322": [-31.6043504, -60.6681858],
  "junges|güemes 3701": [-31.6365799, -60.6886389],
  "long|av. aristóbulo del valle 4026": [-31.6309116, -60.7009294],
  "mergen|av. peñaloza 7308": [-31.5967279, -60.7120923],
  "ortega|blas parera 8448": [-31.5824173, -60.7262878],
  "pedro a. kornijuk|av. fdo. zuviría 5323": [-31.6172440, -60.7055840],
  "sartor|rivadavia 3300": [-31.6378569, -60.7015326],
  "valverde|1° de mayo 2215": [-31.6491690, -60.7115127],
  "verónica cano|suipacha 2912": [-31.6392554, -60.7087703],
  "vignolo|av. gral. paz 4698": [-31.6268027, -60.6903095],
  "bonazzola estefanía|av. a. del valle 5118": [-31.6207662, -60.6986590],
  "brambilla|estanislao zeballos 3731": [-31.6023816, -60.7092007],
  "burgi|bv. pellegrini 3187": [-31.6340597, -60.7111239],
  "colucci|av. freyre 1908": [-31.6516283, -60.7198725],
  "germán lópez|av. gral. paz 5201": [-31.6223432, -60.6872071],
  "gimenez|urquiza 2332": [-31.6470913, -60.7133919],
  "imvinkelried|lavalle 4201": [-31.6318162, -60.6883741],
  "mansilla|9 de julio 1181": [-31.6611547, -60.7138046],
  "menapace|blas parera 7831": [-31.5894791, -60.7250334],
  "ranzuglia|fray cayetano rodríguez 3889": [-31.6184294, -60.7161456],
  "wagner burgués|av. rivadavia 3098": [-31.6407402, -60.7023391],
  "zentner|san jerónimo 3101": [-31.6396601, -60.7061742],
  "azanza|san martín 3001": [-31.6411290, -60.7050190],
  "belgrano|rivadavia 3237": [-31.6389940, -60.7020998],
  "bonazzola|av. freyre 2298": [-31.6463934, -60.7184915],
  "costa|av. blas parera 5671": [-31.6110299, -60.7189613],
  "morello|av. f.zuviría 4201": [-31.6281989, -60.7053240],
  "wagner|av. f. zuviría 4201": [-31.6281989, -60.7053240],
};

// ---------------------------------------------------------------------------
// Normalización: saca acentos, signos y caracteres rotos por encoding.
// "San Jerónimo 3101", "San Jer?nimo 3101" y "SAN JERONIMO 3101"
// terminan todos en "san jeronimo 3101".
// ---------------------------------------------------------------------------
function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFFFD/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function claveDe(name, addr) {
  return norm(name) + "|" + norm(addr);
}

// Tabla normalizada, construida una sola vez al cargar el módulo.
const COORDS_NORM = {};
for (const k of Object.keys(KNOWN_COORDS)) {
  const [n, a] = k.split("|");
  COORDS_NORM[claveDe(n, a)] = KNOWN_COORDS[k];
}

// Caché en memoria del contenedor: sobrevive entre invocaciones mientras
// Netlify mantenga la lambda tibia. Evita re-geocodificar lo mismo.
const COORDS_RUNTIME = {};
let MEMO = null; // { expira, payload }

// ---------------------------------------------------------------------------
// Utilidades de HTML
// ---------------------------------------------------------------------------
function stripTags(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Busca una frase permitiendo tags o espacios entre las palabras
// (el HTML de El Litoral mete <b> en el medio de los encabezados).
function buscarFrase(html, palabras) {
  const re = new RegExp(
    palabras.map(escapeRe).join("(?:\\s|&nbsp;|<[^>]*>)+"),
    "i"
  );
  const m = re.exec(html);
  return m ? m.index : -1;
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------
const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};

// Extrae todos los "8:00 hs del Jueves 27 de agosto del 2026" de un fragmento.
function parseFechas(fragmento) {
  const txt = stripTags(fragmento).join(" ");
  const re = /(\d{1,2}):(\d{2})\s*hs?\D{0,40}?(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ\uFFFD]+)\s+del\s+(\d{4})/g;
  const out = [];
  let m;
  while ((m = re.exec(txt)) !== null) {
    const hora = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const dia = parseInt(m[3], 10);
    const mes = MESES[norm(m[4])];
    const anio = parseInt(m[5], 10);
    if (mes === undefined) continue;
    // La hora es argentina (UTC-3) → se convierte a UTC sumando 3.
    const ts = new Date(Date.UTC(anio, mes, dia, hora + AR_OFFSET_H, min));
    const dd = String(dia).padStart(2, "0");
    const mm = String(mes + 1).padStart(2, "0");
    const hh = String(hora).padStart(2, "0");
    const nn = String(min).padStart(2, "0");
    out.push({ ts, txt: `${dd}/${mm} ${hh}:${nn} hs` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Separación de los dos turnos publicados
// ---------------------------------------------------------------------------
function elegirBloqueTurno(html, ahora) {
  const iDesde = buscarFrase(html, ["Turnos", "desde", "las"]);
  const iPartir = buscarFrase(html, ["Turnos", "a", "partir", "de", "las"]);

  // Un solo bloque publicado: se usa todo.
  if (iPartir === -1) {
    const inicio = iDesde === -1 ? 0 : iDesde;
    const f = parseFechas(html.slice(inicio, inicio + 400));
    return {
      html: html.slice(inicio),
      cual: "vigente",
      periodo: f.length >= 2 ? `Desde ${f[0].txt} hasta ${f[1].txt}` : null,
    };
  }

  const inicio1 = iDesde === -1 || iDesde > iPartir ? 0 : iDesde;
  const bloque1 = html.slice(inicio1, iPartir);
  const bloque2 = html.slice(iPartir);

  const f1 = parseFechas(html.slice(inicio1, inicio1 + 400));
  const f2 = parseFechas(html.slice(iPartir, iPartir + 400));

  const arrancaSegundo = f2.length >= 1 ? f2[0].ts.getTime() : null;
  const terminaPrimero = f1.length >= 2 ? f1[1].ts.getTime() : null;

  const yaEsElSegundo =
    (arrancaSegundo !== null && ahora >= arrancaSegundo) ||
    (arrancaSegundo === null && terminaPrimero !== null && ahora >= terminaPrimero);

  if (yaEsElSegundo) {
    return {
      html: bloque2,
      cual: "proximo",
      periodo: f2.length >= 1 ? `A partir de ${f2[0].txt}` : null,
    };
  }
  return {
    html: bloque1,
    cual: "vigente",
    periodo: f1.length >= 2 ? `Desde ${f1[0].txt} hasta ${f1[1].txt}` : null,
  };
}

// ---------------------------------------------------------------------------
// Teléfono: "0342 - 4894243 / 4894287" → display + versión marcable
// ---------------------------------------------------------------------------
function armarTel(crudo) {
  const primero = String(crudo || "").split("/")[0];
  let d = primero.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.slice(1);
  // Celular escrito con el 15 intercalado: 342 15 5927199 → +54 9 342 5927199
  if (d.startsWith("34215")) d = "9342" + d.slice(5);
  if (d.length < 8) return null;
  return "+54" + d;
}

// ---------------------------------------------------------------------------
// Extracción de farmacias de un bloque de turno
// ---------------------------------------------------------------------------
function extraerFarmacias(bloque) {
  const re = /<a[^>]+mapa\.php\/(\d+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)DE\s*TURNO/gi;
  const vistas = new Set();
  const out = [];
  let m;

  while ((m = re.exec(bloque)) !== null) {
    const nombreLineas = stripTags(m[2]);
    const name = (nombreLineas[0] || "").trim();
    if (!name) continue;

    const lineas = stripTags(m[3]);
    const addr = lineas.find((l) => /[A-Za-zÁÉÍÓÚÑáéíóúñ].*\d/.test(l)) || "";
    const telLinea =
      lineas.find(
        (l) => /^[\d\s\-\/+]+$/.test(l) && l.replace(/\D/g, "").length >= 6
      ) || "";
    if (!addr) continue;

    const key = claveDe(name, addr);
    if (vistas.has(key)) continue;
    vistas.add(key);

    out.push({
      key,
      name,
      addr,
      phone: telLinea.replace(/\s+/g, ""),
      tel: armarTel(telLinea),
      lat: null,
      lon: null,
      fuenteCoord: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Geocoding con Nominatim (OpenStreetMap)
// ---------------------------------------------------------------------------
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function dentroDeSantaFe(lat, lon) {
  return (
    lat >= BBOX.latMin && lat <= BBOX.latMax &&
    lon >= BBOX.lonMin && lon <= BBOX.lonMax
  );
}

async function consultarNominatim(q) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1" +
    "&countrycodes=ar&bounded=1&viewbox=" + VIEWBOX +
    "&q=" + encodeURIComponent(q);
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es", Accept: "application/json" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!Array.isArray(j) || !j.length) return null;
  const lat = parseFloat(j[0].lat);
  const lon = parseFloat(j[0].lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  if (!dentroDeSantaFe(lat, lon)) return null;
  return [lat, lon];
}

async function geocodificar(name, addr) {
  // Primero con el nombre (por si la farmacia está mapeada como POI),
  // después solo por dirección, que es más confiable para la calle.
  const intentos = [
    `Farmacia ${name}, ${addr}, Santa Fe, Santa Fe, Argentina`,
    `${addr}, Santa Fe, Santa Fe, Argentina`,
  ];
  for (let i = 0; i < intentos.length; i++) {
    try {
      const r = await consultarNominatim(intentos[i]);
      if (r) return r;
    } catch (e) { /* se sigue con el próximo intento */ }
    if (i < intentos.length - 1) await dormir(DELAY_NOMINATIM_MS);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
function respuesta(status, payload) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=240",
      ...CORS_HEADERS,
    },
    body: JSON.stringify(payload),
  };
}

exports.handler = async function () {
  const t0 = Date.now();

  if (MEMO && MEMO.expira > Date.now()) {
    return respuesta(200, { ...MEMO.payload, cached: true });
  }

  try {
    const resp = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TurnoCercanoBot/1.1)" },
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    // FIX CLAVE: la página es ISO-8859-1, no UTF-8.
    const buf = await resp.arrayBuffer();
    const html = new TextDecoder("iso-8859-1").decode(buf);

    const ahora = Date.now();
    const bloque = elegirBloqueTurno(html, ahora);
    const farmacias = extraerFarmacias(bloque.html);

    // 1) Resolver lo que ya conocemos (tabla + caché del contenedor).
    const pendientes = [];
    for (const f of farmacias) {
      const c = COORDS_NORM[f.key] || COORDS_RUNTIME[f.key];
      if (c) {
        f.lat = c[0];
        f.lon = c[1];
        f.fuenteCoord = COORDS_NORM[f.key] ? "tabla" : "cache";
      } else {
        pendientes.push(f);
      }
    }

    // 2) Geocodificar lo que falte, con tope de tiempo y de cantidad.
    let geocodificadas = 0;
    for (const f of pendientes) {
      if (geocodificadas >= MAX_GEOCODE_POR_CORRIDA) break;
      if (Date.now() - t0 > PRESUPUESTO_GEOCODE_MS) break;
      if (geocodificadas > 0) await dormir(DELAY_NOMINATIM_MS);
      const c = await geocodificar(f.name, f.addr);
      geocodificadas++;
      if (c) {
        f.lat = c[0];
        f.lon = c[1];
        f.fuenteCoord = "geocoding";
        COORDS_RUNTIME[f.key] = c; // queda cacheada para las próximas corridas
      }
    }

    const limpiar = ({ key, fuenteCoord, ...resto }) => resto;
    const ubicadas = farmacias.filter((f) => f.lat !== null).map(limpiar);
    const sinUbicar = farmacias.filter((f) => f.lat === null).map(limpiar);

    const payload = {
      ok: true,
      source: SOURCE_URL,
      turno: bloque.cual,          // "vigente" | "proximo"
      periodo: bloque.periodo,
      updatedAt: new Date().toISOString(),
      total: farmacias.length,     // farmacias de turno según El Litoral
      count: ubicadas.length,      // las que se pueden ubicar en el mapa
      missingCount: sinUbicar.length,
      geocodedThisRun: geocodificadas,
      pharmacies: ubicadas,
      unlocated: sinUbicar,        // con nombre, dirección y teléfono
    };

    MEMO = { expira: Date.now() + MEMO_TTL_MS, payload };
    return respuesta(200, payload);
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
      }),
    };
  }
};
