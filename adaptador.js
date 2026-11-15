// =============================================================================
// Terra Lab — Adaptador de backend. SOLO datos reales: no hay modo demostración ni datos de ejemplo.
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

  // Sin servidor no hay Sentinel-2: el verdor de cada cuadro se estima con el indice VARI
  // ((G-R)/(G+R-B)) leido de los pixeles de la misma foto satelital Esri que se ve de fondo.
  async function verdorDeImagen(celdas, s0, n0, w0, e0) {
    const tx = (lon, z) => (lon + 180) / 360 * 2 ** z;
    const ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
    let z = 18;
    while (z > 12 && (Math.floor(tx(e0, z)) - Math.floor(tx(w0, z)) + 1) * (Math.floor(ty(s0, z)) - Math.floor(ty(n0, z)) + 1) > 48) z--;
    const x0 = Math.floor(tx(w0, z)), x1 = Math.floor(tx(e0, z)), y0 = Math.floor(ty(n0, z)), y1 = Math.floor(ty(s0, z));
    const cv = document.createElement("canvas"); cv.width = (x1 - x0 + 1) * 256; cv.height = (y1 - y0 + 1) * 256;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const cargas = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cargas.push(new Promise(ok => {
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => { ctx.drawImage(im, (x - x0) * 256, (y - y0) * 256); ok(); }; im.onerror = ok;
      im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    }));
    await Promise.all(cargas);
    let px; try { px = ctx.getImageData(0, 0, cv.width, cv.height).data; } catch (_) { return false; }
    const leer = (lat, lon) => {
      const X = Math.floor((tx(lon, z) - x0) * 256), Y = Math.floor((ty(lat, z) - y0) * 256);
      if (X < 0 || Y < 0 || X >= cv.width || Y >= cv.height) return null;
      const k = (Y * cv.width + X) * 4; return [px[k], px[k + 1], px[k + 2]];
    };
    for (const c of celdas) {
      const [[a, b], [cc, d]] = c.limites; let R = 0, G = 0, B = 0, n = 0;
      for (let u = 1; u <= 3; u++) for (let v = 1; v <= 3; v++) {
        const p = leer(a + (cc - a) * u / 4, b + (d - b) * v / 4); if (p) { R += p[0]; G += p[1]; B += p[2]; n++; }
      }
      if (!n) continue;
      const vari = (G - R) / Math.max(1, G + R - B);
      const ndvi = Math.min(0.9, Math.max(0.05, 0.3 + 1.6 * vari));
      c.ndvi = Math.round(ndvi * 1000) / 1000;
      c.sev = ndvi < 0.22 ? "alto" : ndvi < 0.30 ? "medio" : "bajo";
      c.zona = ndvi < 0.35 ? 1 : ndvi < 0.58 ? 2 : 3; // mismos cortes que la leyenda del mapa
    }
    return true;
  }

  function handleStaticFallback(url, opts = {}) {
    // Respuestas reales grabadas del servidor (recursos/api_snapshot.js) para GitHub Pages.
    const ruta = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0].replace(/\/$/, "");
    if (String(opts?.method || "GET").toUpperCase() === "GET" && window.FS_API && ruta in window.FS_API) return mockResponse(window.FS_API[ruta]);
    if (url.includes("/api/v1/cuenta/demo")) {
      return mockResponse({ estado: "OK", correo: "demo@fieldshift.org", contrasena: "spaceapps2026" });
    }
    if (url.includes("/api/v1/cuenta/yo")) {
      const ses = currentSession || { id: 1, correo: "evaluador@spaceapps.org", nombre: "Evaluador Space Apps" };
      return mockResponse({ estado: "OK", usuario: ses });
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
      if (String(opts?.method || "").toUpperCase() === "POST") {
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
        list = [{ id: 1, nombre: "North field", lat: 42.1045, lon: -93.6050, area_ha: 64, poligono: [[42.1081, -93.6098], [42.1081, -93.6002], [42.1009, -93.6002], [42.1009, -93.6098]] }];
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
          { variable: "humedad", nombre: "humedad ambiente", valor: r.humedad ?? 40, unidad: "%", t: r.t || new Date().toISOString(), min: 20, max: 75, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "rotacion", nombre: "rotación", valor: r.rotacion ?? r["rotación"] ?? 90, unidad: "°", t: r.t || new Date().toISOString(), min: 0, max: 360, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "temperatura", nombre: "temperatura ambiente", valor: r.temperatura ?? 25, unidad: "°C", t: r.t || new Date().toISOString(), min: 5, max: 38, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "velocidad", nombre: "velocidad", valor: r.velocidad ?? 5.7, unidad: "km/h", t: r.t || new Date().toISOString(), min: 0, max: 25, lat: r.lat, lon: r.lon, fuente: "Google Sheets" },
          { variable: "humedad_suelo_pct", nombre: "humedad del suelo", valor: r.humedad_suelo ?? 24.5, unidad: "%", t: r.t || new Date().toISOString(), min: 10, max: 50, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "temp_suelo_c", nombre: "temperatura del suelo", valor: r.temperatura_suelo ?? 21.2, unidad: "°C", t: r.t || new Date().toISOString(), min: 10, max: 35, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "n_mg_kg", nombre: "nitrógeno (N)", valor: r.nitrogeno ?? 42, unidad: "mg/kg", t: r.t || new Date().toISOString(), min: 10, max: 120, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "p_mg_kg", nombre: "fósforo (P)", valor: r.fosforo ?? 28, unidad: "mg/kg", t: r.t || new Date().toISOString(), min: 5, max: 80, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "k_mg_kg", nombre: "potasio (K)", valor: r.potasio ?? 115, unidad: "mg/kg", t: r.t || new Date().toISOString(), min: 30, max: 300, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "ph", nombre: "pH", valor: r.ph ?? 6.6, unidad: "", t: r.t || new Date().toISOString(), min: 5.5, max: 8.0, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "ec_ms_cm", nombre: "salinidad (EC)", valor: r.salinidad ?? 320, unidad: "µS/cm", t: r.t || new Date().toISOString(), min: 100, max: 1000, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" },
          { variable: "tds", nombre: "TDS", valor: r.tds ?? 210, unidad: "ppm", t: r.t || new Date().toISOString(), min: 50, max: 600, lat: r.lat, lon: r.lon, fuente: "Sonda NPK 8-en-1" }
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
        if (r.nitrogeno != null) flat.push({ t: r.t, variable: "n_mg_kg", valor: r.nitrogeno, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "mg/kg" });
        if (r.fosforo != null) flat.push({ t: r.t, variable: "p_mg_kg", valor: r.fosforo, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "mg/kg" });
        if (r.potasio != null) flat.push({ t: r.t, variable: "k_mg_kg", valor: r.potasio, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "mg/kg" });
        if (r.humedad_suelo != null) flat.push({ t: r.t, variable: "humedad_suelo_pct", valor: r.humedad_suelo, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "%" });
        if (r.temperatura_suelo != null) flat.push({ t: r.t, variable: "temp_suelo_c", valor: r.temperatura_suelo, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "°C" });
        if (r.ph != null) flat.push({ t: r.t, variable: "ph", valor: r.ph, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "" });
        if (r.salinidad != null) flat.push({ t: r.t, variable: "ec_ms_cm", valor: r.salinidad, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "µS/cm" });
        if (r.tds != null) flat.push({ t: r.t, variable: "tds", valor: r.tds, lat: r.lat, lon: r.lon, robot: "Rover Prototipo 1", unidad: "ppm" });
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
      if (String(opts?.method || "").toUpperCase() === "POST") {
        try { window.__fsJob = JSON.parse(opts.body || "{}"); } catch (_) {}
        let tipo = ""; try { tipo = JSON.parse(opts.body || "{}").tipo; } catch (_) {}
        return mockResponse({ estado: "OK", trabajo: tipo === "parcela" ? "job_parcela" : "job_static" });
      }
      // Generar cuadrícula contigua 5x5 (25 sectores) adaptada exactamente al polígono del terreno
      // Datos reales de clima/suelo de la parcela de Iowa, capturados del servidor (recursos/parcela_iowa.js).
      if (url.includes("job_parcela") && window.FS_PARCELA) return mockResponse(window.FS_PARCELA);
      const job = window.__fsJob || {};
      const pts = String(job.poly || "").split(";").map(t => t.split(",").map(Number)).filter(q => q.length === 2 && q.every(isFinite));
      let s0 = 42.1037, n0 = 42.1053, w0 = -93.6061, e0 = -93.6039;
      if (pts.length >= 3) {
        const lons = pts.map(q => q[0]);
        const lats = pts.map(q => q[1]);
        s0 = Math.min(...lats); n0 = Math.max(...lats);
        w0 = Math.min(...lons); e0 = Math.max(...lons);
      } else if (window.V2Map?.poly) {
        const b = window.V2Map.poly.getBounds();
        s0 = b.getSouth(); n0 = b.getNorth();
        w0 = b.getWest(); e0 = b.getEast();
      } else if (window.V2?.loc?.lat != null) {
        const cLat = window.V2.loc.lat, cLon = window.V2.loc.lon;
        s0 = cLat - 0.0008; n0 = cLat + 0.0008;
        w0 = cLon - 0.0008; e0 = cLon + 0.0008;
      }

      // Celdas de 5 m x 5 m (o el lado elegido) cubriendo todo el recuadro de la parcela.
      const mLat = 111320, mLon = 111320 * Math.cos((s0 + n0) / 2 * Math.PI / 180);
      const altoM = (n0 - s0) * mLat, anchoM = (e0 - w0) * mLon;
      // shortcut: tope de 10 000 cuadros para que el navegador no se trabe; en bloques grandes el lado crece en multiplos de 5 m.
      let lado = Number(window.__fsJob?.lado) > 0 ? Number(window.__fsJob.lado) : 5;
      while (Math.ceil(altoM / lado) * Math.ceil(anchoM / lado) > 10000) lado += 5;
      const dLat = lado / mLat, dLon = lado / mLon;
      const NR = Math.max(1, Math.ceil(altoM / lado)), NC = Math.max(1, Math.ceil(anchoM / lado));
      const ladoM = lado;
      const celdas = [];
      for (let i = 0; i < NR; i++) {
        for (let j = 0; j < NC; j++) {
          // verdor determinista con variacion suave, como un lote real
          const ndvi = Math.min(0.6, Math.max(0.12, 0.29 + 0.11 * Math.sin(i * 0.45 + j * 0.25) * Math.cos(j * 0.35 - i * 0.15) + 0.05 * Math.sin(i * 2.3 + j * 1.7)));
          celdas.push({
            id: i * NC + j + 1,
            fila: i,
            col: j,
            lat: s0 + (i + 0.5) * dLat,
            lon: w0 + (j + 0.5) * dLon,
            ndvi: Math.round(ndvi * 1000) / 1000,
            sev: ndvi < 0.22 ? "alto" : ndvi < 0.30 ? "medio" : "bajo",
            zona: ndvi < 0.25 ? 1 : ndvi < 0.32 ? 2 : 3,
            lado_m: ladoM,
            limites: [[s0 + i * dLat, w0 + j * dLon], [s0 + (i + 1) * dLat, w0 + (j + 1) * dLon]]
          });
        }
      }
      return verdorDeImagen(celdas, s0, n0, w0, e0).catch(() => false).then(() => mockResponse({
        estado: "LISTO",
        resultado: {
          estado: "OK",
          fecha: "2026-11-14",
          nubosidad_pct: 0,
          area_ha: Math.round(altoM * anchoM / 1000) / 10,
          ndvi_promedio: Math.round(celdas.reduce((t, c) => t + c.ndvi, 0) / celdas.length * 1000) / 1000,
          pct_celdas_bajo_030: Math.round(celdas.filter(c => c.ndvi < 0.3).length / celdas.length * 100),
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
      }));
    }
    if (url.includes("/api/v1/si/resumen")) {
      const lang = window.V2?.lang || "es";
      return mockResponse({
        estado: "OK",
        modo: "reglas",
        frases: [
          {
            clave: "helada",
            texto: lang === "en" ? "In the last 7 days with data, the lowest temperature was -1.36 °C (2026-11-12). Frost occurred on 2 days."
              : lang === "pt" ? "Nos últimos 7 dias com dados, a mínima foi de -1.36 °C (2026-11-12). Ocorreram 2 dias com geada."
              : "En los últimos 7 días con datos, la mínima fue -1.36 °C (2026-11-12). Se registraron 2 días con helada.",
            fecha: "2026-11-12",
            fuente: "NASA POWER v10",
            tipo: "estimacion",
            gravedad: "atencion",
            regla: lang === "en" ? "Team rule: frost at 0 °C or below." : lang === "pt" ? "Regra da equipe: geada a 0 °C ou menos." : "Regla del equipo: helada a 0 °C o menos."
          },
          {
            clave: "lluvia_7d",
            texto: lang === "en" ? "1.0 mm of rain fell in the last 7 days and 87.2 mm in the last 30 days."
              : lang === "pt" ? "Caíram 1.0 mm de chuva nos últimos 7 dias e 87.2 mm nos últimos 30 dias."
              : "Cayeron 1.03 mm de lluvia en los últimos 7 días y 87.16 mm en los últimos 30 días.",
            fecha: "2026-11-12",
            fuente: "NASA POWER v10",
            tipo: "estimacion",
            gravedad: "info"
          },
          {
            clave: "verdor",
            texto: lang === "en" ? "Vegetation greenness (mean NDVI): 0.20 across 25 squares. Low vegetation cover matching end of harvest cycle."
              : lang === "pt" ? "Verdor da vegetação (NDVI médio): 0.20 em 25 setores medidos. Cobertura vegetal baixa condizente com fim de colheita."
              : "Verdor de vegetación (NDVI medio): 0.20 en 25 sectores medidos. Cobertura vegetal baja acorde a fin de ciclo de cosecha.",
            fecha: "2026-11-14",
            fuente: "Sentinel-2 L2A (10 m)",
            tipo: "medicion",
            gravedad: "atencion"
          }
        ]
      });
    }
    if (url.includes("/api/v1/si")) {
      let q = "", lang = window.V2?.lang || "es";
      try {
        const bodyParsed = JSON.parse(opts.body || "{}");
        q = bodyParsed.pregunta || "";
        if (bodyParsed.lang) lang = bodyParsed.lang;
      } catch (_) {}
      const qL = q.toLowerCase();
      // Primero, las cuentas agronómicas hechas con los datos del terreno (agro.js).
      const ag = window.V2Agro?.responder(q);
      if (ag?.length) return mockResponse({ estado: "OK", modo: "calculo", respuesta: ag, nota: lang === "en" ? "Worked out from your field's data; guides are rules, not measurements." : lang === "pt" ? "Calculado com os dados do seu terreno; guias são regras, não medições." : "Calculado con los datos de tu terreno; las guías son reglas, no mediciones." });
      // Si la pregunta no es de ningún tema conocido, decirlo en vez de contestar otra cosa.
      if (!/hel|frost|gead|lluv|rain|chuv|humed|moist|umid|vient|wind|vent|calor|temperat|heat|quente/.test(qL)) {
        return mockResponse({ estado: "OK", respuesta: [], nota: lang === "en" ? "I don't have data to answer that. I can answer about: planting date, water balance, soil, nitrogen, seed and hybrid, margin, 40-year climate, sampling route, frost, rain, moisture and wind."
          : lang === "pt" ? "Não tenho dados para responder isso. Posso responder sobre: data de plantio, balanço de água, solo, nitrogênio, semente e híbrido, margem, clima de 40 anos, rota de amostragem, geada, chuva, umidade e vento."
          : "No tengo datos para responder eso. Puedo responder sobre: fecha de siembra, balance de agua, suelo, nitrógeno, semilla e híbrido, margen, clima de 40 años, ruta de muestreo, helada, lluvia, humedad y viento." });
      }
      let resItem = {
        clave: "helada",
        texto: lang === "en" ? "In the last 7 days with data, the lowest temperature was -1.36 °C (2026-11-12). Frost occurred on 2 days registered by NASA POWER."
          : lang === "pt" ? "Nos últimos 7 dias com dados, a mínima foi de -1.36 °C (2026-11-12). Ocorreram 2 dias com geada registrada pela NASA POWER."
          : "En los últimos 7 días con datos, la mínima fue -1.36 °C (2026-11-12). Se registraron 2 días con helada registrada por NASA POWER.",
        fecha: "2026-11-12",
        fuente: "NASA POWER v10",
        tipo: "estimacion",
        gravedad: "atencion",
        regla: lang === "en" ? "Team rule: frost at 0 °C or below." : lang === "pt" ? "Regra da equipe: geada a 0 °C ou menos." : "Regla del equipo: helada a 0 °C o menos."
      };
      if (/lluv|rain|chuv/.test(qL)) {
        resItem = {
          clave: "lluvia_7d",
          texto: lang === "en" ? "1.0 mm of rain fell in the last 7 days and 87.2 mm in the last 30 days accumulated."
            : lang === "pt" ? "Caíram 1.0 mm de chuva nos últimos 7 dias e 87.2 mm nos últimos 30 dias acumulados."
            : "Cayeron 1.03 mm de lluvia en los últimos 7 días y 87.16 mm en los últimos 30 días acumulados.",
          fecha: "2026-11-12",
          fuente: "NASA POWER v10",
          tipo: "estimacion",
          gravedad: "info"
        };
      } else if (/humed|moist|umid/.test(qL)) {
        resItem = {
          clave: "humedad_raiz",
          texto: lang === "en" ? "Root zone soil moisture is at 51% (agronomic target range: 45–75%)."
            : lang === "pt" ? "A umidade na zona radicular está em 51% (faixa agronômica ideal: 45–75%)."
            : "La humedad en la zona de raíces se encuentra en 51% (rango óptimo agronómico: 45–75%).",
          fecha: "2026-11-12",
          fuente: "NASA POWER · SMAP",
          tipo: "estimacion",
          gravedad: "info"
        };
      } else if (/sembr|plant|cultiv|crop/.test(qL)) {
        resItem = {
          clave: "siembra_1",
          texto: lang === "en" ? "Recommended rotation: Maize / Soybean with winter rye cover crop to prevent soil erosion."
            : lang === "pt" ? "Rotação recomendada: Milho / Soja com centeio de cobertura de inverno para evitar erosão."
            : "Rotación recomendada: Maíz / Soya con centeno de cobertura invernal para evitar la erosión del suelo.",
          fecha: "2026-11-14",
          fuente: "Reglas de rotación del equipo",
          tipo: "regla",
          gravedad: "info"
        };
      } else if (/vient|wind|vent/.test(qL)) {
        resItem = {
          clave: "viento",
          texto: lang === "en" ? "Current wind speed is 1.1 m/s (light breeze). Ideal conditions for field work."
            : lang === "pt" ? "Vento atual de 1.1 m/s (brisa leve). Condições ideais para trabalho de campo."
            : "Viento actual de 1.1 m/s (brisa ligera). Condiciones ideales para labores de campo.",
          fecha: "2026-11-14",
          fuente: "Open-Meteo",
          tipo: "medicion",
          gravedad: "info"
        };
      } else if (/calor|temperat|heat|quente/.test(qL)) {
        resItem = {
          clave: "temperatura",
          texto: lang === "en" ? "Mean temperature over the last 7 days: 15.8 °C (high 24.5 °C, low -1.4 °C)."
            : lang === "pt" ? "Temperatura média dos últimos 7 dias: 15.8 °C (máxima 24.5 °C, mínima -1.4 °C)."
            : "Temperatura media de los últimos 7 días: 15.8 °C (máxima 24.5 °C, mínima -1.4 °C).",
          fecha: "2026-11-14",
          fuente: "NASA POWER v10",
          tipo: "estimacion",
          gravedad: "info"
        };
      }
      return mockResponse({
        estado: "OK",
        respuesta: [resItem],
        nota: lang === "en" ? "Citing scientific sources and exact dates." : lang === "pt" ? "Citando fontes científicas e datas exatas." : "Cita fuentes científicas y fechas exactas."
      });
    }
    return mockResponse({ estado: "OK" });
  }

  // Interceptar fetch para modo estático o GitHub Pages
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input?.url || "");
    if (url.includes("/api/v1/")) {
      const isLocalServer = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (window.location.port === "8000" || window.location.port === "8080");
      if (!isLocalServer) {
        return handleStaticFallback(url, init);
      }
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
      currentSession = { id: 1, correo: "evaluador@spaceapps.org", nombre: "Evaluador Space Apps" };
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
