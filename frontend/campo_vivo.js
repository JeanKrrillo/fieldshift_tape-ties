// =============================================================================
// Field Shift — Datos reales siempre a la vista sobre el mapa.
// Flechas de viento con su velocidad, tablero de tiempo de ahora y las capas «altas para el campo» del catálogo a un toque.
// Nada aquí es simulado: cada número trae su fuente y su hora.
// =============================================================================
(function () {
  "use strict";
  const esc = (s) => window.esc(s);
  const m = (es, en, pt) => (window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es);
  const MAPA = () => window.V2Map?.map;

  const V2Campo = {
    capa: null, datos: null, encendido: true, espera: null,

    async cargar() {
      const mp = MAPA();
      if (!mp || !this.encendido || window.V2.space !== "mapa") return;
      const b = mp.getBounds();
      try {
        const j = await (await fetch(`/api/v1/capas/aire?sur=${b.getSouth().toFixed(3)}&oeste=${b.getWest().toFixed(3)}&norte=${b.getNorth().toFixed(3)}&este=${b.getEast().toFixed(3)}`, { credentials: "same-origin" })).json();
        if (j.estado === "OK") { this.datos = j; this.pintar(); }
      } catch (_) {}
    },

    pintar() {
      const mp = MAPA(), d = this.datos;
      if (!mp) return;
      if (this.capa) mp.removeLayer(this.capa);
      this.capa = null;
      this.tablero();
      if (!d || !this.encendido) return;
      // La flecha apunta hacia donde va el viento (la dirección meteorológica dice de dónde viene)
      this.capa = L.layerGroup(d.puntos.map(p => L.marker([p.lat, p.lon], { interactive: true, keyboard: false, icon: L.divIcon({ className: "", iconSize: [56, 44], iconAnchor: [28, 22],
        html: `<div class="viento"><span class="viento-flecha" style="transform:rotate(${(p.viento_dir + 180) % 360}deg)">➤</span><b>${p.viento_ms.toFixed(1)}</b><small>m/s</small><i>${Math.round(p.temp_c)}°</i></div>` }) })
        .bindTooltip(`<b>${esc(m("Ahora en este punto", "Now at this point", "Agora neste ponto"))}</b><br>${esc(m("Viento", "Wind", "Vento"))} ${p.viento_ms} m/s ${esc(m("desde", "from", "de"))} ${Math.round(p.viento_dir)}° · ${esc(m("rachas", "gusts", "rajadas"))} ${p.rachas_ms} m/s<br>${p.temp_c} °C · ${p.humedad_pct} % · ${p.lluvia_mm} mm<br><span style="opacity:.7">${esc(d.fuente)} · ${esc(p.hora)} UTC · ${esc(m("estimación", "estimate", "estimativa"))}</span>`))).addTo(mp);
    },

    // Tablero arriba a la izquierda del mapa: el punto más cercano al centro, con fuente y hora
    tablero() {
      let t = document.getElementById("campo-tablero");
      if (!t) { t = document.createElement("div"); t.id = "campo-tablero"; document.getElementById("v2-stage")?.appendChild(t); }
      const d = this.datos, mp = MAPA();
      t.hidden = window.V2.space !== "mapa" || !d;
      if (!d || !mp) return;
      const c = mp.getCenter();
      const p = d.puntos.reduce((a, x) => (Math.hypot(x.lat - c.lat, x.lon - c.lng) < Math.hypot(a.lat - c.lat, a.lon - c.lng) ? x : a));
      const r = window.V2.terrainResp;
      const pt = [
        [m("Aire", "Air", "Ar"), `${p.temp_c.toFixed(1)}`, "°C"], [m("Viento", "Wind", "Vento"), `${p.viento_ms.toFixed(1)}`, `m/s <span class="viento-mini" style="display:inline-block;transform:rotate(${(p.viento_dir + 180) % 360}deg)">➤</span>`],
        [m("Humedad", "Humidity", "Umidade"), `${Math.round(p.humedad_pct)}`, "%"], [m("Lluvia ahora", "Rain now", "Chuva agora"), `${p.lluvia_mm.toFixed(1)}`, "mm"],
        ...(r?.ndvi_promedio != null ? [[m("Verdor del terreno", "Field greenness", "Verdor do terreno"), r.ndvi_promedio.toFixed(2), "NDVI"]] : []),
      ];
      t.innerHTML = `
        <div class="ct-cifras">${pt.map(([a, v, u]) => `<div><span>${esc(a)}</span><b>${esc(v)}</b><small>${u}</small></div>`).join("")}</div>
        <div class="ct-pie"><span class="ct-vivo" aria-hidden="true"></span>${esc(d.fuente)} · ${esc(p.hora.replace("T", " "))} UTC${r?.fecha ? ` · Sentinel-2 ${esc(r.fecha)}` : ""}
          <button type="button" class="ct-btn" data-campo-viento aria-pressed="${this.encendido}">${esc(this.encendido ? m("Ocultar flechas", "Hide arrows", "Ocultar setas") : m("Ver flechas", "Show arrows", "Ver setas"))}</button></div>`;
    },

    // Capas del catálogo marcadas como «alta para el campo», una por tema, a un toque
    tira() {
      let t = document.getElementById("campo-capas");
      if (!t) { t = document.createElement("div"); t.id = "campo-capas"; document.getElementById("v2-stage")?.appendChild(t); }
      const gibs = window.V2.catalog?.gibs || [];
      t.hidden = window.V2.space !== "mapa" || !gibs.length;
      if (!gibs.length) return;
      const temas = [["temperatura", m("Temperatura", "Temperature", "Temperatura"), /land_surface_temp_day|air_temp|temperature/i], ["vegetacion", m("Biomasa y verdor", "Biomass & greenness", "Biomassa e verdor"), /ndvi_8day|evi_8day|lai_8day/i],
        ["cultivos", m("Tierras de cultivo", "Croplands", "Terras de cultivo"), /cropland|crop/i], ["biomas", m("Cobertura y biomas", "Land cover & biomes", "Cobertura e biomas"), /land_cover|landcover|biome/i],
        ["lluvia", m("Lluvia", "Rainfall", "Chuva"), /imerg_precipitation_rate$|precipitation/i], ["humedad", m("Humedad del suelo", "Soil moisture", "Umidade do solo"), /smap_l4_analyzed_root/i],
        ["urbano", m("Urbano y rural", "Urban & rural", "Urbano e rural"), /urban|population|built|night/i], ["incendios", m("Calor detectado", "Detected heat", "Calor detectado"), /thermal_anomalies/i]];
      const elegidas = temas.map(([k, n, rx]) => ({ k, n, c: gibs.find(c => c.representante && c.utilidad === "alta" && rx.test(c.id)) || gibs.find(c => c.representante && rx.test(c.id)) })).filter(x => x.c);
      t.innerHTML = `<span class="cc-tit">${esc(m("Capas para el campo", "Layers for farming", "Camadas para o campo"))}</span>` + elegidas.map(x => {
        const on = window.V2Map.isLayerOn("gibs", x.c.id);
        return `<button type="button" class="cc-chip ${on ? "on" : ""}" data-campo-capa="${esc(x.c.id)}" aria-pressed="${on}" title="${esc((x.c.titulo_largo || x.c.titulo) + " · " + (x.c.tiempo || ""))}">${esc(x.n)}</button>`;
      }).join("");
    },

    init() {
      const V = window.V2, mp = MAPA();
      if (!V || !mp || !window.V2Map?.isLayerOn) return setTimeout(() => this.init(), 400);
      mp.on("moveend", () => { clearTimeout(this.espera); this.espera = setTimeout(() => this.cargar(), 700); });
      const pintar = V.renderActiveViews.bind(V);
      V.renderActiveViews = (...a) => { const r = pintar(...a); this.tira(); this.tablero(); if (V.space === "mapa" && !this.datos) this.cargar(); return r; };
      document.addEventListener("click", async (e) => {
        const c = e.target.closest("[data-campo-capa]");
        if (c) { const on = !window.V2Map.isLayerOn("gibs", c.dataset.campoCapa); await window.V2Map.toggleLayer("gibs", c.dataset.campoCapa, on); this.tira(); return; }
        if (e.target.closest("[data-campo-viento]")) { this.encendido = !this.encendido; this.pintar(); if (this.encendido && !this.datos) this.cargar(); }
      });
      setInterval(() => this.cargar(), 15 * 60 * 1000);
      this.tira(); this.cargar();
    },
  };

  window.V2Campo = V2Campo;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(() => V2Campo.init(), 500)); else setTimeout(() => V2Campo.init(), 500);
})();
