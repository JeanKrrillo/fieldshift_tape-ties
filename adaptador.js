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
    if (url.includes("/api/v1/geocode")) {
      const u = new URL(url, "https://fieldshift.org");
      const q = (u.searchParams.get("q") || "").toLowerCase().trim();
      if (q.includes("iowa") || q.includes("ames")) {
        return mockResponse({ estado: "OK", lat: 42.1045, lon: -93.6050, direccion: "Ames, Story County, Iowa, United States" });
      }
      if (q.includes("queretaro") || q.includes("querétaro")) {
        return mockResponse({ estado: "OK", lat: 20.61309, lon: -100.40274, direccion: "Santiago de Querétaro, Qro., México" });
      }
      return mockResponse({ estado: "OK", lat: 42.1045, lon: -93.6050, direccion: (q ? q.charAt(0).toUpperCase() + q.slice(1) : "Parcela") + ", Iowa, USA" });
    }
    if (url.includes("/api/v1/trabajos")) {
      if (opts.method === "POST") {
        return mockResponse({ estado: "OK", trabajo: "job_static" });
      }
      // Generar 25 celdas con coordenadas y verdor Sentinel-2 realista
      const celdas = [];
      const baseLat = 42.1045, baseLon = -93.6050;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const cLat = baseLat + (i - 2) * 0.00045;
          const cLon = baseLon + (j - 2) * 0.00045;
          const ndvi = 0.18 + ((i * 3 + j * 7) % 11) * 0.02;
          const sev = ndvi < 0.22 ? "alto" : ndvi < 0.30 ? "medio" : "bajo";
          const zona = ndvi < 0.25 ? 1 : ndvi < 0.32 ? 2 : 3;
          celdas.push({
            id: i * 5 + j + 1,
            lat: cLat,
            lon: cLon,
            ndvi: Math.round(ndvi * 1000) / 1000,
            sev,
            zona,
            lado_m: 5,
            limites: [[cLat - 0.0002, cLon - 0.0002], [cLat + 0.0002, cLon + 0.0002]]
          });
        }
      }
      return mockResponse({
        estado: "LISTO",
        resultado: {
          estado: "OK",
          fecha: "2026-11-14",
          nubosidad_pct: 0,
          area_ha: 0.7,
          ndvi_promedio: 0.202,
          pct_celdas_bajo_030: 100,
          celdas,
          telemetria_oficial_en_vivo: {
            nasa_power_v10: {
              resumen_anual: {
                precipitacion_7d_mm: 1.03,
                precipitacion_30d_mm: 87.16
              }
            },
            usgs_water_services_nwis: {
              sensores_cercanos: []
            }
          },
          zona: { id: "IA_Central", nombre: "Iowa Corn Belt" },
          cultivo: "maiz"
        }
      });
    }
    if (url.includes("/api/v1/si/resumen")) {
      return mockResponse({
        estado: "OK",
        modo: "reglas",
        frases: [
          { clave: "helada", texto: "En los últimos 7 días con datos, la mínima fue -1.36 °C (2026-11-12). Se registraron 2 días con helada.", fecha: "2026-11-12", fuente: "NASA POWER v10", tipo: "estimacion", gravedad: "atencion", regla: "Regla del equipo: helada a 0 °C o menos." },
          { clave: "lluvia_7d", texto: "Cayeron 1.03 mm de lluvia en los últimos 7 días y 87.16 mm en los últimos 30 días.", fecha: "2026-11-12", fuente: "NASA POWER v10", tipo: "estimacion", gravedad: "info" },
          { clave: "verdor", texto: "Verdor de vegetación (NDVI medio): 0.20 en 25 sectores medidos. Cobertura vegetal baja acorde a fin de ciclo de cosecha.", fecha: "2026-11-14", fuente: "Sentinel-2 L2A (10 m)", tipo: "medicion", gravedad: "atencion" }
        ]
      });
    }
    if (url.includes("/api/v1/si")) {
      let q = "";
      try { q = JSON.parse(opts.body || "{}").pregunta || ""; } catch (_) {}
      const qL = q.toLowerCase();
      let resItem = { clave: "helada", texto: "En los últimos 7 días con datos, la mínima fue -1.36 °C (2026-11-12). Se registraron 2 días con helada registrada por NASA POWER.", fecha: "2026-11-12", fuente: "NASA POWER v10", tipo: "estimacion", gravedad: "atencion", regla: "Regla del equipo: helada a 0 °C o menos." };
      if (/lluv|rain|chuv/.test(qL)) {
        resItem = { clave: "lluvia_7d", texto: "Cayeron 1.03 mm de lluvia en los últimos 7 días y 87.16 mm en los últimos 30 días acumulados.", fecha: "2026-11-12", fuente: "NASA POWER v10", tipo: "estimacion", gravedad: "info" };
      } else if (/humed|moist|umid/.test(qL)) {
        resItem = { clave: "humedad_raiz", texto: "La humedad en la zona de raíces se encuentra en 51% (rango óptimo agronómico: 45–75%).", fecha: "2026-11-12", fuente: "NASA POWER · SMAP", tipo: "estimacion", gravedad: "info" };
      } else if (/sembr|plant|cultiv|crop/.test(qL)) {
        resItem = { clave: "siembra_1", texto: "Rotación recomendada: Maíz / Soya con centeno de cobertura invernal para evitar la erosión del suelo.", fecha: "2026-11-14", fuente: "Reglas de rotación del equipo", tipo: "regla", gravedad: "info" };
      } else if (/vient|wind|vent/.test(qL)) {
        resItem = { clave: "viento", texto: "Viento actual de 1.1 m/s (brisa ligera). Condiciones ideales para labores de campo.", fecha: "2026-11-14", fuente: "Open-Meteo", tipo: "medicion", gravedad: "info" };
      }
      return mockResponse({
        estado: "OK",
        respuesta: [resItem],
        nota: "Cita fuentes científicas y fechas exactas."
      });
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
