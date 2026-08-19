// ============================================================================
// Netlify Function: /.netlify/functions/farmacias
//
// Lee el HTML público de El Litoral (que reproduce el cronograma oficial del
// Colegio de Farmacéuticos de Santa Fe 1ra Circunscripción), extrae la lista
// de farmacias "DE TURNO" y les asigna coordenadas.
//
// Corre del lado del servidor de Netlify, así que no tiene el problema de
// CORS que sí tiene el navegador. El front-end (index.html) llama a esta
// función cada 10 minutos.
//
// LIMITACIÓN CONOCIDA: solo tenemos coordenadas precargadas (KNOWN_COORDS)
// para las farmacias que ya identificamos. Si el turno rota a una farmacia
// nueva que no está en esta tabla, se descarta de los resultados (mejor
// mostrar una lista incompleta y confiable que una con ubicaciones
// inventadas). Hay que ir ampliando esta tabla con el tiempo.
// ============================================================================

const SOURCE_URL = "https://servicios.ellitoral.com/seccion/farmacias/";

// El front-end ahora vive en otro dominio (altouch.com.ar), distinto al de
// esta función (netlify.app), así que el navegador exige que la respuesta
// diga explícitamente qué orígenes puede aceptar. Es un dato público sin
// información sensible, así que "*" es válido — si en algún momento preferís
// restringirlo, cambiá esta línea por "https://altouch.com.ar".
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// clave = (nombre + "|" + dirección tal cual aparece en El Litoral).toLowerCase().trim()
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

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/gi, "Á").replace(/&deg;/gi, "°")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractPeriodo(html) {
  const m = html.match(
    /Turnos desde las[^0-9]*([\d:]+\s*hs[^*<]*)[^0-9]*hasta las[^0-9]*([\d:]+\s*hs[^*<]*?)\./i
  );
  if (!m) return null;
  return ("Desde " + m[1] + " hasta " + m[2])
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPharmacies(html) {
  // Cada entrada tiene un link a mapa.php/<id> con el nombre en negrita,
  // seguido de dirección, teléfono, botón "Llamar" y el texto "DE TURNO".
  const blockRegex =
    /<a[^>]+mapa\.php\/(\d+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)DE\s*TURNO/gi;
  const seen = new Set();
  const out = [];
  let match;

  while ((match = blockRegex.exec(html)) !== null) {
    const nameLines = stripTags(match[2]);
    const name = (nameLines[0] || "").trim();
    if (!name) continue;

    const chunkLines = stripTags(match[3]);
    // Dirección: primera línea que tiene letras y termina/incluye un número de altura
    const addr = chunkLines.find((l) => /[A-Za-zÁÉÍÓÚÑáéíóúñ].*\d/.test(l)) || "";
    // Teléfono: línea mayormente numérica
    const phoneLine = chunkLines.find((l) => /\d{3,}/.test(l) && /^[\d\s\-\/+]+$/.test(l)) || "";
    const phone = phoneLine.replace(/\s+/g, "").replace(/^0/, "0");

    if (!addr) continue;
    const key = (name + "|" + addr).toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const coords = KNOWN_COORDS[key];
    out.push({
      name,
      addr,
      phone,
      lat: coords ? coords[0] : null,
      lon: coords ? coords[1] : null,
    });
  }
  return out;
}

exports.handler = async function () {
  try {
    const resp = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TurnoCercanoBot/1.0)" },
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const html = await resp.text();

    const periodo = extractPeriodo(html);
    const all = extractPharmacies(html);
    const located = all.filter((p) => p.lat !== null);
    const missing = all.length - located.length;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=240",
        ...CORS_HEADERS,
      },
      body: JSON.stringify({
        ok: true,
        source: SOURCE_URL,
        periodo,
        updatedAt: new Date().toISOString(),
        count: located.length,
        missingCount: missing,
        pharmacies: located,
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }),
    };
  }
};
