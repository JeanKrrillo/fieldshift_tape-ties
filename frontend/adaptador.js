// =============================================================================
// Field Shift — Adaptador de backend. SOLO datos reales: no hay modo demostración ni datos de ejemplo.
// Si el backend no responde, se lanza un error claro o se devuelve vacío; nunca se inventa un valor.
// =============================================================================
(function () {
  "use strict";

  let currentSession = null;

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
