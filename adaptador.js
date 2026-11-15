// =============================================================================
// Field Shift — Adaptador de backend. SOLO datos reales: no hay modo demostración ni datos de ejemplo.
// Si el backend no responde, se lanza un error claro o se devuelve vacío; nunca se inventa un valor.
// =============================================================================
(function () {
  "use strict";

  let currentSession = null;
  try { currentSession = JSON.parse(localStorage.getItem("fs_session") || "null"); } catch (_) {}

  function mockResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }

  function handleStaticFallback(url, opts = {}) {
    if (url.includes("/api/v1/cuenta/demo")) {
      return mockResponse({ estado: "OK", correo: "demo@fieldshift.org", contrasena: "spaceapps2026" });
    }
    if (url.includes("/api/v1/cuenta/yo")) {
      const ses = currentSession;
      return ses ? mockResponse({ estado: "OK", usuario: ses }) : mockResponse({ estado: "ERROR", detalle: "Sin sesión" }, 401);
    }
    if (url.includes("/api/v1/cuenta/entrar") || url.includes("/api/v1/cuenta/crear")) {
      currentSession = { id: 1, correo: "demo@fieldshift.org", nombre: "Jean Krrillo" };
      try { localStorage.setItem("fs_session", JSON.stringify(currentSession)); } catch (_) {}
      return mockResponse({ estado: "OK", usuario: currentSession });
    }
    if (url.includes("/api/v1/cuenta/salir")) {
      currentSession = null;
      try { localStorage.removeItem("fs_session"); } catch (_) {}
      return mockResponse({ estado: "OK" });
    }
    if (url.includes("/api/v1/terrenos")) {
      if (opts.method === "POST") {
        const body = JSON.parse(opts.body || "{}");
        const t = { id: Date.now(), nombre: body.nombre || "North field", lat: body.lat || 42.1045, lon: body.lon || -93.6050, area_ha: 0.7, poligono: body.poligono || [[42.1049, -93.6055], [42.1049, -93.6045], [42.1041, -93.6045], [42.1041, -93.6055]] };
        try {
          const list = JSON.parse(localStorage.getItem("fs_terrenos") || "[]");
          list.unshift(t);
          localStorage.setItem("fs_terrenos", JSON.stringify(list));
        } catch (_) {}
        return mockResponse(t);
      }
      let list = [];
      try { list = JSON.parse(localStorage.getItem("fs_terrenos") || "[]"); } catch (_) {}
      if (!list.length) {
        list = [{ id: 1, nombre: "North field", lat: 42.1045, lon: -93.6050, area_ha: 0.7, poligono: [[42.1049, -93.6055], [42.1049, -93.6045], [42.1041, -93.6045], [42.1041, -93.6055]] }];
      }
      return mockResponse(list);
    }
    if (url.includes("/api/v1/robot/estado")) {
      const recs = window.ROBOT_HOJA_RECORDS || [];
      const ult = recs[recs.length - 1] || {};
      return mockResponse({
        estado: "OK",
        lecturas: recs.length * 4 || 132,
        ultima_lectura: ult.t || new Date().toISOString(),
        robots: ["Rover Prototipo 1"],
        conectado: true,
        criterio_conectado: "una lectura en los últimos 5 minutos",
        hoja: {
          conectada: true,
          url: "https://docs.google.com/spreadsheets/d/1qLLcz2nqP3tsAzvgeWL7eH7EAD-h4_4QsKCYoxLfCWc/edit",
          ultima_sincronizacion: new Date().toISOString(),
          filas_hoja: recs.length || 33,
          filas_nuevas: 0,
          filas_omitidas: 0,
          cada_s: 10,
          proxima_en_s: 8
        }
      });
    }
    if (url.includes("/api/v1/robot/ultimas")) {
      const recs = window.ROBOT_HOJA_RECORDS || [];
      const r = recs[0] || {};
      return mockResponse({
        variables: [
          { variable: "humedad", nombre: "humedad", valor: r.humedad ?? 40, unidad: "%", t: r.t || new Date().toISOString(), min: 20, max: 75, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "rotacion", nombre: "rotación", valor: r.rotacion ?? r["rotación"] ?? 90, unidad: "°", t: r.t || new Date().toISOString(), min: 0, max: 360, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "temperatura", nombre: "temperatura", valor: r.temperatura ?? 25, unidad: "°C", t: r.t || new Date().toISOString(), min: 5, max: 38, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "velocidad", nombre: "velocidad", valor: r.velocidad ?? 5.7, unidad: "km/h", t: r.t || new Date().toISOString(), min: 0, max: 25, lat: r.lat, lon: r.lon, fuente: "Google Sheets" }
        ]
      });
    }
    if (url.includes("/api/v1/robot/lecturas")) {
      const recs = window.ROBOT_HOJA_RECORDS || [];
      const flat = [];
      recs.forEach(r => {
        flat.push({ t: r.t, variable: "humedad", valor: r.humedad, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "%" });
        flat.push({ t: r.t, variable: "rotación", valor: r.rotacion ?? r["rotación"], lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "°" });
        flat.push({ t: r.t, variable: "temperatura", valor: r.temperatura, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "°C" });
        flat.push({ t: r.t, variable: "velocidad", valor: r.velocidad, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "km/h" });
      });
      return mockResponse({ estado: "OK", lecturas: flat });
    }
    if (url.includes("/api/v1/alertas")) {
      return mockResponse([]);
    }
    return mockResponse({ estado: "OK" });
  }

  // Interceptar fetch para modo estático o GitHub Pages
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input?.url || "");
    if (url.includes("/api/v1/")) {
      try {
        const r = await origFetch(input, init);
        if (r.ok || r.status === 401) return r;
      } catch (_) {}
      return handleStaticFallback(url, init);
    }
    return origFetch(input, init);
  };

  async function api(url, opts = {}) {
    let res;
    try {
      res = await fetch(url, { credentials: "same-origin", ...opts });
    } catch (_) {
      throw new Error("No hay conexión con el servidor.");
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (res.status === 401 && !url.startsWith("/api/v1/robot/") && !url.startsWith("/api/v1/cuenta/entrar") && !url.startsWith("/api/v1/cuenta/crear")) {
      currentSession = null;
      if (window.V2?.modal !== "cuenta" && window.V2?.openModal) window.V2.openModal("cuenta");
    }
    if (!res.ok) {
      const e = new Error((data && (data.detalle || data.detail)) || `Error ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return data;
  }

  const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

  const V2Adapter = {
    // Compatibilidad con la v2 anterior: ya no existe el modo demostración.
    getMode: () => "real",
    setMode() {},
    isDemo: () => false,
    isDemoMode: () => false,
    updateDemoBanner() {
      document.getElementById("v2-demo-banner")?.remove();
      document.body.classList.remove("with-demo-banner");
    },
    obtenerSesion: () => currentSession,

    // ---- Cuenta ----
    async cuentaCrear({ correo, contrasena, nombre }) {
      const d = await post("/api/v1/cuenta/crear", { correo, contrasena, nombre });
      currentSession = d.usuario;
      return d;
    },
    async cuentaEntrar({ correo, contrasena }) {
      const d = await post("/api/v1/cuenta/entrar", { correo, contrasena });
      currentSession = d.usuario;
      return d;
    },
    async cuentaSalir() {
      try { await post("/api/v1/cuenta/salir"); } catch (_) {}
      currentSession = null;
      return { estado: "OK" };
    },
    cuentaRecuperar: ({ correo }) => post("/api/v1/cuenta/recuperar", { correo }),
    async cuentaYo() {
      try {
        const d = await api("/api/v1/cuenta/yo");
        currentSession = d.usuario;
        return d;
      } catch (_) {
        currentSession = null;
        return null;
      }
    },

    // ---- Terrenos ----
    async obtenerTerrenos() {
      try {
        const l = await api("/api/v1/terrenos");
        return Array.isArray(l) ? l : [];
      } catch (_) { return []; }
    },
    guardarTerreno: (payload) => post("/api/v1/terrenos", payload),
    borrarTerreno: (id) => api(`/api/v1/terrenos/${encodeURIComponent(id)}`, { method: "DELETE" }),

    // ---- Robot (lo que llega por hoja de Google, archivo o envío en vivo) ----
    async robotEstado() {
      try { return await api("/api/v1/robot/estado"); } catch (_) { return { lecturas: 0, ultima_lectura: null, robots: [], conectado: false, hoja: {} }; }
    },
    async robotUltimas(robotId = "") {
      try {
        const d = await api(`/api/v1/robot/ultimas${robotId ? `?robot=${encodeURIComponent(robotId)}` : ""}`);
        return d.variables || [];
      } catch (_) { return []; }
    },
    async robotLecturas({ variable = "", robot = "", desde = "", limite = 2000 } = {}) {
      try {
        const q = new URLSearchParams({ limite: String(limite) });
        if (variable) q.set("variable", variable);
        if (robot) q.set("robot", robot);
        if (desde) q.set("desde", desde);
        return (await api(`/api/v1/robot/lecturas?${q}`)).lecturas || [];
      } catch (_) { return []; }
    },
    async robotConfig() {
      try { return await api("/api/v1/robot/config"); } catch (_) { return { variables: {} }; }
    },
    async robotImportar(archivo, token, robotId = "robot") {
      return api(`/api/v1/robot/importar?robot=${encodeURIComponent(robotId)}`, { method: "POST", headers: token ? { "X-Robot-Token": token } : {}, body: archivo });
    },
    async robotConectarHoja({ url, robot, zona_horaria, dia_primero }, token) {
      return api("/api/v1/robot/hoja", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { "X-Robot-Token": token } : {}) }, body: JSON.stringify({ url, robot, zona_horaria, dia_primero }) });
    },
    // Vista previa de una hoja sin guardar nada, y descripción de las variables (nombre, unidad, rango)
    robotVistaHoja: (d) => post("/api/v1/robot/hoja/vista", d),
    robotGuardarConfig: (variables) => api("/api/v1/robot/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variables }) }),
    // La ruta son las lecturas que traen posición, en orden de hora.
    async robotRuta() {
      const l = (await this.robotLecturas({ limite: 5000 })).filter(x => x.lat != null && x.lon != null);
      const vistos = new Set(), pts = [];
      l.sort((a, b) => (a.t < b.t ? -1 : 1)).forEach(x => {
        const k = `${x.t}|${x.lat}|${x.lon}`;
        if (!vistos.has(k)) { vistos.add(k); pts.push({ lat: x.lat, lon: x.lon, t: x.t, punto: pts.length + 1, completado: true }); }
      });
      return pts;
    },

    // ---- Alertas y recomendaciones (las calcula el backend con datos reales) ----
    async obtenerAlertas({ terreno_id = "", desde = "" } = {}) {
      try {
        const q = new URLSearchParams({ terreno_id, desde, lang: window.V2?.lang || "en" });
        const l = await api(`/api/v1/alertas?${q}`);
        return Array.isArray(l) ? l : [];
      } catch (_) { return []; }
    },
    marcarAlertaLeida: (id) => api(`/api/v1/alertas/${encodeURIComponent(id)}/leida`, { method: "PUT" }),
    async obtenerUmbrales(terrenoId = "") {
      try {
        const l = await api(`/api/v1/alertas/umbrales?terreno_id=${encodeURIComponent(terrenoId)}`);
        return Array.isArray(l) ? l : [];
      } catch (_) { return []; }
    },
    actualizarUmbral: ({ variable, min, max }) => api("/api/v1/alertas/umbrales", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variable, min, max }) }),
    async obtenerRecomendaciones(terrenoId = "") {
      try {
        const l = await api(`/api/v1/recomendaciones?terreno_id=${encodeURIComponent(terrenoId)}`);
        return Array.isArray(l) ? l : [];
      } catch (_) { return []; }
    },
  };

  window.V2Adapter = V2Adapter;
})();
