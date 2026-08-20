/* ==========================================================================
   AL TOQUE · Kit Base v1 — Utilidades JS
   Importar en cada herramienta: <script src="/kit/utils.js"></script>
   ========================================================================== */

const AlToque = (() => {
  // ---------- Geolocalización ----------
  function getLocation(timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        return reject(new Error("GEOLOCATION_UNAVAILABLE"));
      }

      let settled = false;
      const failSafe = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("TIMEOUT"));
      }, timeoutMs);

      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (settled) return;
            settled = true;
            clearTimeout(failSafe);
            resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          },
          (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(failSafe);
            reject(
              new Error(
                err.code === err.PERMISSION_DENIED
                  ? "PERMISSION_DENIED"
                  : "POSITION_ERROR"
              )
            );
          },
          { enableHighAccuracy: true, timeout: timeoutMs - 1000, maximumAge: 0 }
        );
      } catch (e) {
        if (!settled) {
          settled = true;
          clearTimeout(failSafe);
          reject(new Error("GEOLOCATION_ERROR"));
        }
      }
    });
  }

  // ---------- Distancia Haversine (km) ----------
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---------- Formato de distancia ----------
  function formatDist(km) {
    return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
  }

  // ---------- Tiempo estimado en auto (km → minutos) ----------
  function driveMinutes(km) {
    return "~" + Math.max(2, Math.round(km / 0.35)) + " min";
  }

  // ---------- Fetch con timeout ----------
  async function fetchJSON(url, opts = {}) {
    const timeout = opts.timeout || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, {
        ...opts,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return await resp.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // ---------- Helpers de DOM ----------
  function $(sel) {
    return document.querySelector(sel);
  }
  function $$(sel) {
    return document.querySelectorAll(sel);
  }
  function show(el) {
    if (typeof el === "string") el = $(el);
    if (el) el.style.display = "";
  }
  function hide(el) {
    if (typeof el === "string") el = $(el);
    if (el) el.style.display = "none";
  }
  function text(sel, val) {
    const el = $(sel);
    if (el) el.textContent = val;
  }
  function html(sel, val) {
    const el = $(sel);
    if (el) el.innerHTML = val;
  }

  // ---------- Registro de Service Worker ----------
  function registerSW(path = "/sw.js") {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register(path).catch(() => {});
      });
    }
  }

  // ---------- Auto-refresh ----------
  function autoRefresh(fn, intervalMs = 600000) {
    fn(false);
    return setInterval(() => fn(true), intervalMs);
  }

  // ---------- API pública ----------
  return {
    getLocation,
    haversine,
    formatDist,
    driveMinutes,
    fetchJSON,
    $,
    $$,
    show,
    hide,
    text,
    html,
    registerSW,
    autoRefresh,
  };
})();
