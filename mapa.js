// =============================================================================
// Field Shift v2 (Cápsula D) — Módulo de Mapa, Terreno, Cuadrícula y Capas
// =============================================================================

(function () {
  "use strict";

  const PLSS_BASE = "https://gis.blm.gov/arcgis";
  const ROBOT_COLORS = ["#DEEBF7", "#9ECAE1", "#4292C6", "#2171B5", "#084594"]; // de menos a más; una sola gama para no sugerir «bueno» o «malo»
  const AI_COLORS = {
    maiz: { bg: "#D99B00", sym: "M", es: "Maíz", en: "Maize", pt: "Milho" },
    soya: { bg: "#2E7D32", sym: "S", es: "Soya", en: "Soy", pt: "Soja" },
    pastizal: { bg: "#689F38", sym: "P", es: "Pastizal", en: "Grass / pasture", pt: "Pastagem" },
    bosque: { bg: "#1B5E20", sym: "B", es: "Bosque", en: "Forest", pt: "Floresta" },
    urbano: { bg: "#795548", sym: "U", es: "Zona construida", en: "Built-up", pt: "Área construída" }
  };

  const V2Map = {
    map: null,
    locMarker: null,
    usgsGroup: null,
    polyGroup: null,
    cellsGroup: null,
    osmLayer: null,
    plssLayer: null,
    drawer: null,
    poly: null,
    polyLabel: "",
    activeLayers: new Map(),
    visCache: new Map(),
    probing: false,
    usgsOn: false,

    init() {
      const m = L.map("v2-map", {
        worldCopyJump: true,
        zoomControl: false
      }).setView([41.9, -93.6], 5);

      L.control.zoom({ position: "bottomright" }).addTo(m);

      const esri = (service) => L.tileLayer(
        `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
        { attribution: "Esri", maxZoom: 18 }
      );
      const baseLayers = {
        "Satélite (Esri)": esri("World_Imagery").addTo(m),
        "Topográfico (Esri)": esri("World_Topo_Map"),
        "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19
        })
      };
      L.control.layers(baseLayers, {}, { position: "bottomright", collapsed: true }).addTo(m);

      this.usgsGroup = L.layerGroup().addTo(m);
      this.polyGroup = L.featureGroup().addTo(m);
      this.cellsGroup = L.layerGroup().addTo(m);
      this.map = m;

      m.on("moveend", () => this.refreshUsgsStations());

      m.on("click", (e) => {
        if (this.drawer && this.drawer._enabled) return;
        const la = e.latlng.lat;
        const lo = e.latlng.lng;
        const lang = window.V2.lang;
        const useTxt = lang === "en" ? "Analyze this point" : lang === "pt" ? "Analisar este ponto" : "Analizar este punto";
        const secTxt = tr("ter_plss_btn");
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`
            <div style="font-family:var(--font-sans);min-width:190px">
              <div style="font-weight:600;margin-bottom:6px">${la.toFixed(4)}, ${lo.toFixed(4)}</div>
              <button type="button" class="btn btn-pri btn-sm" style="width:100%;margin-bottom:6px" data-map-pick="${la},${lo}">${esc(useTxt)}</button>
              <button type="button" class="btn btn-sec btn-sm" style="width:100%" data-map-plss="${la},${lo}">${esc(secTxt)}</button>
            </div>
          `)
          .openOn(m);
      });

      m.on(L.Draw.Event.CREATED, (e) => {
        this.drawer = null;
        this.setPolygonLayer(e.layer, "");
        Promise.resolve(this.analyzeTerrain()).finally(() => window.V2Ubicacion?.volverTrasDibujo());
      });
    },

    setLocationMarker(lat, lon, kind, label) {
      if (!this.map) return;
      if (this.locMarker) this.map.removeLayer(this.locMarker);
      const badgeTxt = kind === "demo" ? tr("demo_badge") : kind === "real" ? tr("real_badge") : tr("sim_badge");
      this.locMarker = L.marker([lat, lon]).addTo(this.map);
      this.locMarker.bindTooltip(`${badgeTxt}${label ? " · " + label : ""}`, {
        permanent: false,
        direction: "top"
      });
      this.map.setView([lat, lon], Math.max(this.map.getZoom(), 13));
    },

    renderPointSensors(sensors) {
      if (!this.usgsGroup) return;
      if (!this.usgsOn) this.usgsGroup.clearLayers();
      (sensors || []).forEach(s => {
        if (s.lat == null || s.lon == null) return;
        L.circleMarker([s.lat, s.lon], {
          radius: 6,
          color: "#1565C0",
          fillColor: "#6DB1F2",
          fillOpacity: 0.85,
          weight: 2
        })
          .bindPopup(`<b>${esc(s.parametro || s.codigo_parametro)}</b>: ${esc(s.valor_actual)} ${esc(s.unidad || "")}<br><small>${esc(s.nombre_estacion || "USGS")}</small>`)
          .addTo(this.usgsGroup);
      });
    },

    startDraw() {
      if (!this.map) return;
      this.clearTerrain(false);
      this.drawer = new L.Draw.Polygon(this.map, {
        shapeOptions: { color: "#2F7D32", weight: 3, fillOpacity: 0.10 },
        allowIntersection: false,
        showArea: false
      });
      this.drawer.enable();
      window.V2.showToast(tr("ter_draw_hint"), 5000);
    },

    clearTerrain(resetState = true) {
      if (this.drawer) {
        try { this.drawer.disable(); } catch (_) {}
        this.drawer = null;
      }
      this.polyGroup?.clearLayers();
      this.cellsGroup?.clearLayers();
      this.poly = null;
      this.polyLabel = "";
      if (this.locMarker) this.locMarker.setOpacity(1);
      if (resetState) {
        window.V2.terrainResp = null;
        window.V2.aiResp = null;
        window.V2.selectedCells.clear();
        this.updateLegend();
        window.V2.renderActiveViews();
      }
    },

    setPolygonCoords(latlngs, label) {
      this.clearTerrain(false);
      const poly = L.polygon(latlngs, {
        color: "#2F7D32",
        weight: 3,
        fillOpacity: 0.08
      });
      this.setPolygonLayer(poly, label);
    },

    fitBoundsSmart(bounds) {
      if (!this.map || !bounds) return;
      const isDesk = window.innerWidth >= 1024;
      const snap = window.V2?.sheetSnap || "mid";
      if (isDesk) {
        const leftPad = snap === "min" ? 80 : snap === "max" ? 780 : 548;
        this.map.fitBounds(bounds, {
          paddingTopLeft: [leftPad, 84],
          paddingBottomRight: [264, 48],
          maxZoom: 17
        });
      } else {
        const botPad = snap === "min" ? 180 : 280;
        this.map.fitBounds(bounds, {
          paddingTopLeft: [24, 88],
          paddingBottomRight: [24, botPad],
          maxZoom: 17
        });
      }
    },

    setPolygonLayer(layer, label) {
      this.polyGroup.clearLayers();
      this.cellsGroup.clearLayers();
      this.poly = layer;
      this.polyLabel = label || "";
      this.polyGroup.addLayer(layer);
      this.fitBoundsSmart(layer.getBounds());
    },

    async analyzeTerrain() {
      if (!this.poly) return;
      const ll = this.poly.getLatLngs()[0];
      const center = this.poly.getBounds().getCenter();
      const cellsN = window.V2.cellsCount || 25;

      // Si aún no hay datos del punto o está lejos, cargar inteligencia del punto central
      if (!window.V2.D || Math.hypot((window.V2.loc?.lat || 0) - center.lat, (window.V2.loc?.lon || 0) - center.lng) > 0.02) {
        window.V2.loadParcelIntelligence(center.lat, center.lng, window.V2.loc?.kind || "sim", this.polyLabel || window.V2.loc?.label || "");
      }

      const polyParam = ll.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
      try {
        const lado = window.V2.cellSide;
        const j = await window.V2.correrTrabajo({ tipo: "terreno", poly: polyParam, celdas: lado ? 2500 : cellsN, lado: lado || null }, tr("tr_terreno"));
        window.V2.terrainResp = j;
        window.V2.selectedCells.clear();
        if (j.estado === "OK" && Array.isArray(j.celdas)) {
          if (window.V2.colorMode === "ai") window.V2.colorMode = "ndvi";
          this.drawGridCells();
        }
        window.V2.saveLastTerrainToStorage();
        window.V2.renderActiveViews();
      } catch (err) {
        window.V2.terrainResp = { estado: "ERROR", detalle: err.message };
        window.V2.renderActiveViews();
        window.V2.showToast(`${tr("ter_fail")} ${err.message}`, 6000);
      } finally {
        window.V2.stopProgress();
      }
    },

    // Robot sobre los cuadros: cada cuadro con lecturas dentro lleva su media (medido). Los demás se estiman por vecindad
    // (inverso de la distancia al cuadrado, IDW) solo si hay al menos 3 cuadros medidos, y siempre marcados como estimados.
    calcRobotCells(cells, variable) {
      const lect = (window.V2Robot?.lecturas || []).filter(l => l.variable === variable && l.lat != null && l.lon != null && typeof l.valor === "number");
      const out = cells.map(() => ({ v: null, n: 0, est: false }));
      const suma = cells.map(() => 0);
      lect.forEach(l => {
        const i = cells.findIndex(c => l.lat >= c.limites[0][0] && l.lat < c.limites[1][0] && l.lon >= c.limites[0][1] && l.lon < c.limites[1][1]);
        if (i >= 0) { suma[i] += l.valor; out[i].n++; }
      });
      const med = [];
      out.forEach((o, i) => { if (o.n) { o.v = suma[i] / o.n; med.push(i); } });
      if (med.length >= 3) {
        const k = Math.cos((cells[0].lat * Math.PI) / 180);
        out.forEach((o, i) => {
          if (o.n) return;
          let sw = 0, sv = 0;
          med.forEach(j => { const dy = cells[i].lat - cells[j].lat, dx = (cells[i].lon - cells[j].lon) * k, w = 1 / (dx * dx + dy * dy); sw += w; sv += w * out[j].v; });
          o.v = sv / sw; o.est = true;
        });
      }
      const vals = med.map(i => out[i].v);
      const meta = window.V2Robot?.ultimasLecturas.find(u => u.variable === variable) || {};
      return { celdas: out, variable, nombre: meta.nombre || variable, unidad: meta.unidad || "", medidos: med.length, estimados: out.filter(o => o.est).length, lecturas: lect.length,
        fuera: lect.length - out.reduce((a, o) => a + o.n, 0), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
    },

    computeStats(cells) {
      const vals = (cells || []).map(c => c.ndvi).filter(v => v != null);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.45;
      const sd = vals.length > 1
        ? Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length)
        : 0.08;
      return { mean, sd: Math.max(sd, 0.03) };
    },

    cellStyleAndBadge(c, idx, stats) {
      const mode = window.V2.colorMode || "ndvi";
      const lang = window.V2.lang;
      const v = c.ndvi;

      if (mode.startsWith("robot:")) {
        const rc = this.robotCells?.celdas[idx];
        if (!rc || rc.v == null) return { color: "#788270", sym: "—", word: tr("nodata"), label: tr("nodata"), sinDato: true };
        const { min, max } = this.robotCells;
        const paso = max > min ? Math.min(4, Math.floor(5 * (rc.v - min) / (max - min))) : 2;
        return { color: ROBOT_COLORS[Math.max(0, paso)], sym: rc.est ? "≈" : "●", word: rc.est ? tr("rb_est") : tr("rb_med"), label: rc.v.toFixed(1), robot: rc };
      }

      if (mode === "ai" && window.V2.aiResp?.celdas?.[idx]) {
        const aiC = window.V2.aiResp.celdas[idx];
        const info = AI_COLORS[aiC.clase] || { bg: "#64748B", sym: "?" };
        const cropName = info[lang] || aiC.clase;
        return {
          color: info.bg,
          sym: info.sym,
          word: cropName,
          label: `${cropName} (${Math.round(aiC.confianza * 100)}%)`
        };
      }

      if (v == null) {
        return { color: "#788270", sym: "—", word: tr("nodata"), label: tr("nodata") };
      }

      if (mode === "sev") {
        const pw = window.V2.D?.telemetria_oficial_en_vivo?.nasa_power_v10?.resumen_anual || {};
        const rz = pw.humedad_zona_radicular_media_pct ?? null;
        const plantStress = Math.max(0, Math.min(1, (0.65 - v) / 0.55));
        // Sin dato de humedad de raíz el riesgo sale solo del verdor; no se supone una humedad
        const waterStress = rz == null ? null : rz < window.V2.thresholds.droughtPct ? 0.8 : rz > window.V2.thresholds.excessPct ? 0.6 : 0.15;
        const sev = waterStress == null ? plantStress : 0.65 * plantStress + 0.35 * waterStress;
        if (sev > 0.58) return { color: "#B3261E", sym: "!", word: tr("st_risk_word"), label: tr("st_risk_word") };
        if (sev > 0.34) return { color: "#C77700", sym: "~", word: tr("st_warn_word"), label: tr("st_warn_word") };
        return { color: "#2E7D32", sym: "✓", word: tr("st_ok_word"), label: tr("st_ok_word") };
      }

      if (mode === "zones") {
        if (v < 0.35) return { color: "#B3261E", sym: "B", word: lang === "en" ? "Low" : "Baja", label: lang === "en" ? "Low zone" : "Zona baja" };
        if (v < 0.58) return { color: "#C77700", sym: "M", word: lang === "en" ? "Med" : "Media", label: lang === "en" ? "Medium zone" : "Zona media" };
        return { color: "#2E7D32", sym: "A", word: lang === "en" ? "High" : "Alta", label: lang === "en" ? "High zone" : "Zona alta" };
      }

      if (mode === "anom") {
        const z = (v - stats.mean) / stats.sd;
        if (z <= -1.2) return { color: "#B3261E", sym: "−", word: lang === "en" ? "Lower" : "Menor", label: `${z.toFixed(1)}σ` };
        if (z >= 1.2) return { color: "#1565C0", sym: "+", word: lang === "en" ? "Higher" : "Mayor", label: `+${z.toFixed(1)}σ` };
        return { color: "#5B664C", sym: "=", word: "Normal", label: `${z.toFixed(1)}σ` };
      }

      // Por defecto: Verdor (NDVI) — incluye símbolo + valor + palabra clara
      if (v < 0.20) return { color: "#B3261E", sym: "✕", word: lang === "en" ? "Bare" : lang === "pt" ? "Solo nu" : "Pelado", label: v.toFixed(2) };
      if (v < 0.30) return { color: "#C77700", sym: "!", word: lang === "en" ? "Low" : lang === "pt" ? "Baixo" : "Bajo", label: v.toFixed(2) };
      if (v < 0.50) return { color: "#D4A017", sym: "~", word: lang === "en" ? "Medium" : lang === "pt" ? "Médio" : "Medio", label: v.toFixed(2) };
      if (v < 0.70) return { color: "#558B2F", sym: "+", word: lang === "en" ? "Good" : lang === "pt" ? "Bom" : "Bueno", label: v.toFixed(2) };
      return { color: "#2E7D32", sym: "✓", word: lang === "en" ? "Dense" : lang === "pt" ? "Denso" : "Alto", label: v.toFixed(2) };
    },

    drawGridCells() {
      this.cellsGroup?.clearLayers();
      const r = window.V2.terrainResp;
      if (!r || !Array.isArray(r.celdas)) {
        this.updateLegend();
        return;
      }
      if (this.poly) {
        this.poly.setStyle({ weight: 2, opacity: 0.35, fillOpacity: 0.01 });
      }
      if (this.locMarker) {
        this.locMarker.setOpacity(0);
      }
      const stats = this.computeStats(r.celdas);
      const sideCount = Math.max(1, Math.round(Math.sqrt(r.celdas.length)));
      const lang = window.V2.lang;
      const modo = window.V2.colorMode || "";
      this.robotCells = modo.startsWith("robot:") ? this.calcRobotCells(r.celdas, modo.slice(6)) : null;

      r.celdas.forEach((cell, idx) => {
        const isSel = window.V2.selectedCells.has(idx);
        const st = this.cellStyleAndBadge(cell, idx, stats);
        const rowNum = cell.fila != null ? cell.fila + 1 : Math.floor(idx / sideCount) + 1;
        const colNum = cell.col != null ? cell.col + 1 : (idx % sideCount) + 1;
        const diffVal = cell.ndvi != null ? cell.ndvi - stats.mean : 0;
        const diffStr = `${diffVal >= 0 ? "+" : ""}${diffVal.toFixed(2)}`;

        const rect = L.rectangle(cell.limites, {
          renderer: this.cellRenderer || (this.cellRenderer = L.canvas({ padding: 0.3 })), // un solo lienzo para todos los cuadros: 2500 no pesan
          color: isSel ? "#FFFFFF" : "#1F2A14",
          weight: isSel ? 5 : 1.25,
          className: isSel ? "celda-elegida" : "",
          dashArray: st.robot?.est ? "2,4" : st.sym === "!" || st.sym === "✕" ? "4,2" : null, // estimado: borde punteado y color más tenue, para no confundirlo con lo medido
          fillColor: st.color,
          fillOpacity: st.robot?.est ? 0.3 : st.sinDato ? 0.15 : 0.65
        });

        // La burbuja se arma solo cuando el cursor entra al cuadro, no para los 2500 de golpe
        const tip = () => {
        const tipHtml = lang === "en"
          ? `<div style="font-family:var(--font-sans);min-width:210px;line-height:1.35">
               <div style="font-weight:700;margin-bottom:3px">Sector #${idx + 1} (Row ${rowNum}, Col ${colNum})</div>
               <div style="font-size:12px">• <b>Plant greenness:</b> ${cell.ndvi != null ? cell.ndvi.toFixed(2) : "—"} / 1.00 (${esc(st.word)})</div>
               <div style="font-size:12px">• <b>Vs. field average (${stats.mean.toFixed(2)}):</b> ${diffStr}</div>
               <div style="font-size:11px;color:#5B664C;margin-top:4px">Click to open this sector’s diagnosis (Shift+click to compare several)</div>
             </div>`
          : `<div style="font-family:var(--font-sans);min-width:220px;line-height:1.35">
               <div style="font-weight:700;margin-bottom:3px">Sector #${idx + 1} de tu terreno (Fila ${rowNum}, Columna ${colNum})</div>
               <div style="font-size:12px">• <b>Verdor de planta:</b> ${cell.ndvi != null ? cell.ndvi.toFixed(2) : "—"} de 1.00 (${esc(st.word)})</div>
               <div style="font-size:12px">• <b>Frente al promedio del lote (${stats.mean.toFixed(2)}):</b> ${diffStr}</div>
               <div style="font-size:11px;color:#5B664C;margin-top:4px">Haz clic para abrir el diagnóstico de este sector (Shift + clic para varios)</div>
             </div>`;

        // Lecturas reales del robot cuya posición cae dentro de este cuadro
        const [[s0, w0], [n0, e0]] = cell.limites;
        const rb = {};
        (window.V2Robot?.lecturas || []).forEach(l => {
          if (l.lat != null && l.lat >= s0 && l.lat <= n0 && l.lon >= w0 && l.lon <= e0 && typeof l.valor === "number") (rb[l.variable] = rb[l.variable] || []).push(l.valor);
        });
        const rbHtml = Object.entries(rb).map(([k, v]) => `<div style="font-size:12px">• <b>Robot · ${esc(k)}:</b> ${(v.reduce((x, y) => x + y, 0) / v.length).toFixed(1)} (${v.length})</div>`).join("");
        const ladoTxt = cell.lado_m ? `<div style="font-size:11px;color:#5B664C">${cell.lado_m} × ${cell.lado_m} m</div>` : "";
        const ancla = '<div style="font-size:11px;color:#5B664C;margin-top:4px">';
        const rc = st.robot;
        const rcHtml = rc ? `<div style="font-size:12px">• <b>${esc(this.robotCells.nombre)}:</b> ${rc.v.toFixed(2)} ${esc(this.robotCells.unidad)} — ${esc(rc.est ? tr("rb_tip_est") : trf("rb_tip_med", { n: rc.n }))}</div>` : "";
        return tipHtml.replace(ancla, rcHtml + rbHtml + ladoTxt + ancla);
        };
        rect.bindTooltip(tip, { direction: "top", sticky: true });

        rect.on("mouseover", () => {
          if (!window.V2.selectedCells.has(idx)) {
            rect.setStyle({ weight: 2.5, color: "#FFFFFF" });
          }
        });
        rect.on("mouseout", () => {
          if (!window.V2.selectedCells.has(idx)) {
            rect.setStyle({ weight: 1.25, color: "#1F2A14" });
          }
        });

        rect.on("click", (ev) => {
          L.DomEvent.stopPropagation(ev);
          if (ev.originalEvent && ev.originalEvent.shiftKey) {
            if (window.V2.selectedCells.has(idx)) window.V2.selectedCells.delete(idx);
            else window.V2.selectedCells.add(idx);
          } else {
            window.V2.selectedCells.clear();
            window.V2.selectedCells.add(idx);
          }
          this.drawGridCells();
          if (window.V2Vivo) window.V2Vivo.popupCelda(idx, ev.latlng); else window.V2.openSheetTab("cell", "mid");
        });

        this.cellsGroup.addLayer(rect);

        // Con más de 100 cuadros las etiquetas se enciman y pesan: el valor se lee al pasar el cursor o al tocar el cuadro
        if (r.celdas.length <= 100) {
        // Etiqueta en el centro del cuadro: línea 1 (#N · Estado) + línea 2 (símbolo + valor)
        const [[s, w], [n, e]] = cell.limites;
        const center = [(s + n) / 2, (w + e) / 2];
        const line1 = `#${idx + 1} · ${st.word}`;
        const line2 = window.V2.colorMode === "ai"
          ? `${st.sym}`
          : `${st.sym} ${cell.ndvi != null ? cell.ndvi.toFixed(2) : ""}`;
        const lblMarker = L.marker(center, {
          interactive: false,
          icon: L.divIcon({
            className: "v2-cell-lbl",
            html: `<span class="v2-cell-badge"><small class="v2-cell-kicker">${esc(line1)}</small><span>${esc(line2)}</span></span>`,
            iconSize: [74, 32],
            iconAnchor: [37, 16]
          })
        });
        this.cellsGroup.addLayer(lblMarker);
        }
      });

      this.updateLegend();
    },

    updateLegend() {
      const box = document.getElementById("v2-map-legend");
      if (!box) return;
      const r = window.V2.terrainResp;
      if (!r || !Array.isArray(r.celdas) || !r.celdas.length) {
        box.hidden = true;
        return;
      }
      if (this.robotCells) {
        const rc = this.robotCells, f = (x) => (x == null ? "—" : x.toFixed(1));
        box.hidden = false;
        box.innerHTML = `
          <div style="font-weight:700;margin-bottom:4px">${esc(rc.nombre)}${rc.unidad ? ` (${esc(rc.unidad)})` : ""} · Robot</div>
          <div style="display:flex;gap:2px;margin-bottom:2px">${ROBOT_COLORS.map(c => `<span style="flex:1;height:10px;background:${c}"></span>`).join("")}</div>
          <div class="row-between" style="font-size:11px"><span>${f(rc.min)}</span><span>${f(rc.max)}</span></div>
          <div style="font-size:11.5px;margin-top:6px"><span style="display:inline-block;width:12px;height:12px;background:${ROBOT_COLORS[2]};border:1px solid #1F2A14;vertical-align:-2px"></span> ${esc(trf("rb_leg_med", { n: rc.medidos, t: r.celdas.length }))}</div>
          <div style="font-size:11.5px"><span style="display:inline-block;width:12px;height:12px;background:${ROBOT_COLORS[2]};opacity:.45;border:1px dashed #1F2A14;vertical-align:-2px"></span> ${esc(rc.estimados ? trf("rb_leg_est", { n: rc.estimados }) : tr("rb_leg_noest"))}</div>
          ${rc.fuera ? `<div class="mut" style="font-size:10.5px;margin-top:4px">${esc(trf("rb_leg_fuera", { n: rc.fuera }))}</div>` : ""}
          <div class="mut" style="font-size:10.5px;margin-top:4px">${esc(trf("rb_leg_src", { n: rc.lecturas }))}</div>
          <button type="button" class="btn btn-txt btn-sm" style="width:100%;justify-content:flex-start;padding:4px 0;margin-top:4px;font-size:11.5px" data-sheet-tab="terrain">${esc(tr("rb_leg_cambiar"))}</button>`;
        return;
      }
      box.hidden = false;
      const mode = window.V2.colorMode || "ndvi";
      const lang = window.V2.lang;

      let title = tr("cm_ndvi");
      let modeDesc = "";
      let rows = [];

      if (mode === "ai" && window.V2.aiResp) {
        title = tr("ai_title");
        modeDesc = lang === "en"
          ? "Crop estimated by SI reading 6 satellite dates from the season."
          : "Cultivo estimado por SI leyendo 6 fotos satelitales de la temporada.";
        rows = Object.values(AI_COLORS).map(x => [x.bg, x.sym, x[lang] || x.es]);
      } else if (mode === "sev") {
        title = tr("cm_sev");
        modeDesc = lang === "en"
          ? "Combines low plant cover with root-zone drought or excess moisture."
          : "Cruza falta de cobertura vegetal con sequía o exceso de humedad.";
        rows = [
          ["#2E7D32", "✓", tr("st_ok_word")],
          ["#C77700", "~", tr("st_warn_word")],
          ["#B3261E", "!", tr("st_risk_word")]
        ];
      } else if (mode === "zones") {
        title = tr("cm_zones");
        modeDesc = lang === "en"
          ? "Splits your field into 3 vigor zones to adjust seed or fertilizer."
          : "Divide tu lote en 3 zonas para ajustar semilla, riego o fertilizante.";
        rows = [
          ["#2E7D32", "A", lang === "en" ? "High vigor (≥ 0.58)" : "Zona alta (≥ 0.58)"],
          ["#C77700", "M", lang === "en" ? "Medium (0.35–0.57)" : "Zona media (0.35–0.57)"],
          ["#B3261E", "B", lang === "en" ? "Low (< 0.35)" : "Zona baja (< 0.35)"]
        ];
      } else if (mode === "anom") {
        title = tr("cm_anom");
        modeDesc = lang === "en"
          ? "Shows which sectors are greener (+) or weaker (−) than your field’s average."
          : "Muestra qué sectores están mejor (+) o peor (−) que el promedio de tu lote.";
        rows = [
          ["#1565C0", "+", lang === "en" ? "Above field avg (≥ +1.2σ)" : "Mejor que el lote (≥ +1.2σ)"],
          ["#5B664C", "=", lang === "en" ? "Near field avg (−1.2σ to +1.2σ)" : "Igual al promedio (−1.2σ a +1.2σ)"],
          ["#B3261E", "−", lang === "en" ? "Below field avg (≤ −1.2σ)" : "Más débil que el lote (≤ −1.2σ)"]
        ];
      } else {
        title = tr("cm_ndvi");
        modeDesc = lang === "en"
          ? "Scale from 0 (bare dirt) to 1 (dense green leaves). Click any square on the map to inspect it."
          : "Escala de 0 (tierra pelada) a 1 (planta muy tupida). Toca cualquier cuadro del mapa para ver su diagnóstico.";
        rows = [
          ["#2E7D32", "✓", lang === "en" ? "0.70–1.00 · Dense plants" : "0.70–1.00 · Planta densa (Alto)"],
          ["#558B2F", "+", lang === "en" ? "0.50–0.69 · Good cover" : "0.50–0.69 · Buena cobertura (Bueno)"],
          ["#D4A017", "~", lang === "en" ? "0.30–0.49 · Medium cover" : "0.30–0.49 · Cobertura media (Medio)"],
          ["#C77700", "!", lang === "en" ? "0.20–0.29 · Low cover" : "0.20–0.29 · Poca planta (Bajo)"],
          ["#B3261E", "✕", lang === "en" ? "0.00–0.19 · Bare soil" : "0.00–0.19 · Suelo pelado (Pelado)"]
        ];
      }

      const modePills = [
        ["ndvi", lang === "en" ? "Greenness" : "Verdor"],
        ["sev", lang === "en" ? "Risk" : "Riesgo"],
        ["zones", lang === "en" ? "3 Zones" : "3 Zonas"],
        ["anom", lang === "en" ? "Vs. Avg" : "Vs. lote"]
      ];
      if (window.V2.aiResp?.estado === "OK") {
        modePills.push(["ai", "IA"]);
      }

      const legHdr = lang === "en" ? "What do the map squares show?" : lang === "pt" ? "O que mostram os quadros do mapa?" : "¿Qué muestran los cuadros del mapa?";
      const legCfgBtn = lang === "en" ? "Change grid size (9–100) or draw →" : "Cambiar cuadros (9–100) o dibujar →";

      box.innerHTML = `
        <div style="font-weight:700;font-size:12.5px;margin-bottom:4px">${esc(legHdr)}</div>
        <div class="legend-modes" role="group" aria-label="${esc(tr("ter_color_by"))}">
          ${modePills.map(([mId, mLbl]) => `
            <button type="button" class="legend-mode-btn ${mode === mId ? "active" : ""}" data-color-mode="${mId}">${esc(mLbl)}</button>
          `).join("")}
        </div>
        <div style="font-weight:600;margin-bottom:2px">${esc(title)}</div>
        <div class="mut" style="font-size:11px;line-height:1.35;margin-bottom:6px">${esc(modeDesc)}</div>
        ${rows.map(([col, sym, txt]) => `
          <div class="legend-row">
            <span class="legend-swatch" style="background:${col}">${esc(sym)}</span>
            <span>${esc(txt)}</span>
          </div>
        `).join("")}
        <div class="mut" style="margin-top:6px;font-size:10.5px">Sentinel-2 L2A (10 m) · ${esc(r.fecha || "")}</div>
        <button type="button" class="btn btn-txt btn-sm" style="width:100%;justify-content:flex-start;padding:4px 0;margin-top:4px;font-size:11.5px" data-sheet-tab="terrain">
          ${esc(legCfgBtn)}
        </button>
      `;
    },

    async runAiCropClassifier() {
      if (!this.poly) {
        window.V2.showToast(
          window.V2.lang === "en" ? "Draw or select a field first." : "Primero dibuja o elige tu terreno.",
          4000
        );
        return;
      }
      const ll = this.poly.getLatLngs()[0];
      const polyParam = ll.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
      const cellsN = window.V2.cellsCount || 25;

      try {
        const j = await window.V2.correrTrabajo({ tipo: "cultivos_ia", poly: polyParam, celdas: cellsN }, tr("tr_ia"));
        window.V2.aiResp = j;
        if (j.estado === "OK") {
          window.V2.colorMode = "ai";
          this.drawGridCells();
          window.V2.renderActiveViews();
        } else {
          window.V2.showToast(j.detalle || j.estado || "Error IA", 5000);
        }
      } catch (err) {
        window.V2.showToast("Error SI: " + err.message, 5000);
      } finally {
        window.V2.stopProgress();
      }
    },

    // Tomar sección oficial de 1 milla cuadrada (BLM PLSS) con un clic
    async adoptPlssSection(lat, lon) {
      if (this.map) this.map.closePopup();
      const targetLat = lat ?? window.V2.loc?.lat ?? this.map.getCenter().lat;
      const targetLon = lon ?? window.V2.loc?.lon ?? this.map.getCenter().lng;

      window.V2.startProgress(
        window.V2.lang === "en"
          ? "Querying official BLM PLSS survey section…"
          : "Consultando sección catastral oficial BLM PLSS…");
      try {
        const url = `${PLSS_BASE}/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/2/query?geometry=${targetLon},${targetLat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FRSTDIVLAB,PLSSID&outSR=4326&returnGeometry=true&f=json`;
        const r = await (await fetch(url)).json();
        const feat = r.features?.[0];
        if (!feat || !feat.geometry?.rings?.[0]) {
          window.V2.showToast(
            window.V2.lang === "en"
              ? "No BLM PLSS section here (covers ~30 Midwest/Western US states)."
              : "Aquí no hay sección oficial BLM PLSS (cubre ~30 estados del Medio Oeste y Oeste de EE. UU.).",
            5000
          );
          return;
        }
        const ring = feat.geometry.rings[0].map(([x, y]) => [y, x]);
        const lbl = `BLM PLSS Sec. ${feat.attributes?.FRSTDIVLAB || ""} (${feat.attributes?.PLSSID || ""})`;
        this.setPolygonCoords(ring, lbl);
        window.V2.openSheetTab("terrain", "mid");
        await this.analyzeTerrain();
      } catch (err) {
        window.V2.showToast("BLM PLSS: " + err.message, 4500);
      } finally {
        window.V2.stopProgress();
      }
    },

    // Cargar campos agrícolas de OpenStreetMap con un clic
    async loadOsmFields() {
      if (!this.map) return;
      const b = this.map.getBounds();
      const c = b.getCenter();
      const dLat = Math.min(Math.max(b.getNorth() - b.getSouth(), 0.02), 0.08) / 2;
      const dLon = Math.min(Math.max(b.getEast() - b.getWest(), 0.02), 0.08) / 2;
      const sur = (c.lat - dLat).toFixed(5), norte = (c.lat + dLat).toFixed(5);
      const oeste = (c.lng - dLon).toFixed(5), este = (c.lng + dLon).toFixed(5);

      window.V2.startProgress(
        window.V2.lang === "en"
          ? "Searching agricultural fields on OpenStreetMap…"
          : "Buscando campos agrícolas en OpenStreetMap…");

      let geojson = null;
      try {
        const r = await fetch(`/api/v1/b/osm-campos?sur=${sur}&oeste=${oeste}&norte=${norte}&este=${este}`);
        if (r.ok) {
          const j = await r.json();
          if (j.geojson) geojson = j.geojson;
          else if (Array.isArray(j.campos) && j.campos.length) {
            geojson = {
              type: "FeatureCollection",
              features: j.campos.map(f => ({
                type: "Feature",
                properties: { osm_id: f.osm_id, name: f.nombre || `OSM #${f.osm_id}`, crop: f.cultivo_tag || "" },
                geometry: { type: "Polygon", coordinates: [f.coordenadas.map(([la, lo]) => [lo, la])] }
              }))
            };
          }
        }
      } catch (_) {}

      if (!geojson) {
        const q = `[out:json][timeout:18];(way["landuse"~"farmland|orchard|vineyard|meadow"](${sur},${oeste},${norte},${este});way["crop"](${sur},${oeste},${norte},${este}););out geom 60;`;
        for (const u of ["https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"]) {
          try {
            const r = await fetch(u, { method: "POST", body: "data=" + encodeURIComponent(q) });
            if (r.ok) {
              const raw = await r.json();
              const feats = (raw.elements || []).filter(e => e.geometry && e.geometry.length >= 4).map(e => ({
                type: "Feature",
                properties: { osm_id: e.id, name: e.tags?.name || `OSM #${e.id}`, crop: e.tags?.crop || "" },
                geometry: { type: "Polygon", coordinates: [e.geometry.map(pt => [pt.lon, pt.lat])] }
              }));
              geojson = { type: "FeatureCollection", features: feats };
              break;
            }
          } catch (_) {}
        }
      }

      window.V2.stopProgress();

      if (this.osmLayer) {
        this.map.removeLayer(this.osmLayer);
        this.osmLayer = null;
      }

      if (!geojson || !geojson.features || !geojson.features.length) {
        window.V2.showToast(
          window.V2.lang === "en"
            ? "No OpenStreetMap fields in this view. Try zooming in or picking the first polygon."
            : "No se encontraron campos de OpenStreetMap en esta vista. Acerca el mapa o dibuja tu terreno.",
          4500
        );
        return;
      }

      this.osmLayer = L.geoJSON(geojson, {
        style: { color: "#1565C0", weight: 2, fillOpacity: 0.18, dashArray: "4,3" },
        onEachFeature: (feat, lyr) => {
          lyr.bindTooltip(`${feat.properties.name || "OSM"} (OpenStreetMap)`);
          lyr.on("click", () => {
            const ring = feat.geometry.coordinates[0].map(([lo, la]) => [la, lo]);
            this.setPolygonCoords(ring, `${feat.properties.name || "Parcela"} (OpenStreetMap)`);
            this.analyzeTerrain();
          });
        }
      }).addTo(this.map);

      // Si hay al menos un campo OSM, adoptar automáticamente el primero con un clic para cumplir flujo de 1 clic
      const first = geojson.features[0];
      if (first?.geometry?.coordinates?.[0]) {
        const ring = first.geometry.coordinates[0].map(([lo, la]) => [la, lo]);
        this.setPolygonCoords(ring, `${first.properties.name || "Parcela"} (OpenStreetMap)`);
        this.analyzeTerrain();
      }
      window.V2.showToast(`${geojson.features.length} — ${tr("ter_osm_hint")}`, 4500);
    },

    // Gestión de Capas (14 útiles + Catálogo Completo)
    gibsDateForLayer(l) {
      const customDate = window.V2.layerDate;
      if (customDate) return customDate;
      if (window.V2.timeOffsetDays < 0) {
        const d = new Date(Date.now() - 5 * 86400000 + window.V2.timeOffsetDays * 86400000);
        return d.toISOString().slice(0, 10);
      }
      return l.tiempo || null;
    },

    makeGibsTileLayer(l) {
      const d = this.gibsDateForLayer(l);
      return L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${d ? d + "/" : ""}${l.matriz}/{z}/{y}/{x}.${l.ext}`,
        { maxNativeZoom: l.nivel, maxZoom: 18, opacity: window.V2.layerOpacity, attribution: "NASA GIBS" }
      );
    },

    async toggleLayer(kind, id, turnOn) {
      const key = `${kind}:${id}`;
      if (kind === "plss") {
        if (turnOn && !this.plssLayer) {
          this.plssLayer = L.tileLayer.wms(`${PLSS_BASE}/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/WMSServer`, {
            layers: "1,2",
            format: "image/png",
            transparent: true,
            version: "1.3.0",
            opacity: window.V2.layerOpacity,
            attribution: "BLM PLSS"
          }).addTo(this.map);
        } else if (!turnOn && this.plssLayer) {
          this.map.removeLayer(this.plssLayer);
          this.plssLayer = null;
        }
        window.V2.renderActiveViews();
        return;
      }

      if (kind === "usgs") {
        this.usgsOn = turnOn;
        await this.refreshUsgsStations();
        window.V2.renderActiveViews();
        return;
      }

      if (!turnOn) {
        const rec = this.activeLayers.get(key);
        if (rec && rec.layer) this.map.removeLayer(rec.layer);
        this.activeLayers.delete(key);
        this.applyCurtainClip();
        window.V2.renderActiveViews();
        return;
      }

      const cat = window.V2.catalog;
      if (!cat) return;

      if (kind === "gibs") {
        const l = (cat.gibs || []).find(x => x.id === id);
        if (!l) return;
        const lyr = this.makeGibsTileLayer(l).addTo(this.map);
        this.activeLayers.set(key, { kind, id, title: l.titulo, meta: l, layer: lyr, note: this.gibsDateForLayer(l) || "" });
      } else if (kind === "lf") {
        const l = (cat.landfire || []).find(x => x.id === id);
        const lyr = L.tileLayer.wms("https://edcintl.cr.usgs.gov/geoserver/landfire/wms", {
          layers: id,
          format: "image/png",
          transparent: true,
          opacity: window.V2.layerOpacity,
          attribution: "USFS/USGS LANDFIRE"
        }).addTo(this.map);
        this.activeLayers.set(key, { kind, id, title: l?.titulo || id, layer: lyr, note: "LANDFIRE WMS" });
      } else if (kind === "pc") {
        const p = this.map.getCenter();
        const bb = [p.lng - 0.05, p.lat - 0.05, p.lng + 0.05, p.lat + 0.05].join(",");
        try {
          const j = await (await fetch(`https://planetarycomputer.microsoft.com/api/stac/v1/search?collections=${encodeURIComponent(id)}&bbox=${bb}&limit=1&sortby=-datetime`)).json();
          const f = (j.features || [])[0];
          if (f?.assets?.tilejson?.href) {
            const tj = await (await fetch(f.assets.tilejson.href)).json();
            const lyr = L.tileLayer(tj.tiles[0], { maxZoom: 18, opacity: window.V2.layerOpacity, attribution: "Planetary Computer" }).addTo(this.map);
            this.activeLayers.set(key, { kind, id, title: id, layer: lyr, note: (f.properties?.datetime || "").slice(0, 10) });
          } else if (f?.assets?.rendered_preview?.href && f.bbox) {
            const lyr = L.imageOverlay(f.assets.rendered_preview.href, [[f.bbox[1], f.bbox[0]], [f.bbox[3], f.bbox[2]]], { opacity: window.V2.layerOpacity }).addTo(this.map);
            this.activeLayers.set(key, { kind, id, title: id, layer: lyr, note: (f.properties?.datetime || "").slice(0, 10) });
          } else {
            window.V2.showToast("Sin escena disponible aquí en Planetary Computer.", 3500);
          }
        } catch (err) {
          window.V2.showToast("Planetary Computer: " + err.message, 3500);
        }
      }

      this.applyCurtainClip();
      window.V2.renderActiveViews();
    },

    isLayerOn(kind, id) {
      if (kind === "plss") return !!this.plssLayer;
      if (kind === "usgs") return !!this.usgsOn;
      return this.activeLayers.has(`${kind}:${id}`);
    },

    updateLayersOpacity(alpha) {
      this.activeLayers.forEach(rec => {
        if (rec.layer && typeof rec.layer.setOpacity === "function") {
          rec.layer.setOpacity(alpha);
        }
      });
      if (this.plssLayer && typeof this.plssLayer.setOpacity === "function") {
        this.plssLayer.setOpacity(alpha);
      }
    },

    updateTimeDimension() {
      this.activeLayers.forEach((rec) => {
        if (rec.kind === "gibs" && rec.meta?.tiempo) {
          this.map.removeLayer(rec.layer);
          rec.layer = this.makeGibsTileLayer(rec.meta).addTo(this.map);
          rec.note = this.gibsDateForLayer(rec.meta) || "";
        }
      });
      this.applyCurtainClip();
    },

    // Cortina comparadora real (recorta el contenedor de teselas superpuestas según porcentaje)
    applyCurtainClip() {
      const pct = window.V2.curtainPct ?? 100;
      const div = document.getElementById("v2-curtain-divider");
      if (div) {
        if (pct < 100 && this.activeLayers.size > 0) {
          div.hidden = false;
          div.style.left = `${pct}%`;
        } else {
          div.hidden = true;
        }
      }
      this.activeLayers.forEach(rec => {
        const container = rec.layer?.getContainer?.();
        if (container) {
          container.style.clipPath = pct < 100 ? `inset(0 ${100 - pct}% 0 0)` : "";
        }
      });
    },

    async refreshUsgsStations() {
      if (!this.usgsGroup || !this.map) return;
      if (!this.usgsOn) return;
      if (this.map.getZoom() < 9) return;
      const b = this.map.getBounds();
      try {
        const r = await (await fetch(`/api/v1/usgs-estaciones?oeste=${b.getWest()}&sur=${b.getSouth()}&este=${b.getEast()}&norte=${b.getNorth()}`)).json();
        this.usgsGroup.clearLayers();
        (r.estaciones || []).forEach(s => {
          L.circleMarker([s.lat, s.lon], { radius: 5, color: "#1565C0", fillOpacity: 0.75 })
            .bindPopup(`<b>${esc(s.nombre)}</b><br>${esc(s.tipo)}<br><a target="_blank" rel="noopener" href="https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(s.id)}">USGS NWIS</a>`)
            .addTo(this.usgsGroup);
        });
      } catch (_) {}
    },

    // Exportar e Importar GeoJSON, KML y CSV
    exportFile(fmt) {
      if (!this.poly) {
        window.V2.showToast("Primero dibuja o selecciona tu terreno.", 3500);
        return;
      }
      const ring = this.poly.getLatLngs()[0].map(p => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
      if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
        ring.push([...ring[0]]);
      }
      const r = window.V2.terrainResp;
      const cells = r?.celdas || [];
      const sideCount = Math.max(1, Math.round(Math.sqrt(cells.length)));
      const dateStr = r?.fecha || new Date().toISOString().slice(0, 10);
      let content = "", mime = "application/json", ext = fmt;

      if (fmt === "geojson") {
        content = JSON.stringify({
          type: "FeatureCollection",
          metadata: { source: "Copernicus Sentinel-2 L2A (10m) + NASA POWER + USDA", date: dateStr },
          features: [
            {
              type: "Feature",
              properties: { role: "boundary", name: this.polyLabel || "Parcel", area_ha: r?.area_ha, ndvi_mean: r?.ndvi_promedio },
              geometry: { type: "Polygon", coordinates: [ring] }
            },
            ...cells.map((c, idx) => {
              const [[s, w], [n, e]] = c.limites;
              const rowNum = c.fila != null ? c.fila + 1 : Math.floor(idx / sideCount) + 1;
              const colNum = c.col != null ? c.col + 1 : (idx % sideCount) + 1;
              return {
                type: "Feature",
                properties: { cell: idx + 1, row: rowNum, col: colNum, ndvi: c.ndvi, side_m: c.lado_m },
                geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
              };
            })
          ]
        }, null, 2);
      } else if (fmt === "kml") {
        mime = "application/vnd.google-earth.kml+xml";
        const coords = ring.map(([lo, la]) => `${lo},${la},0`).join(" ");
        content = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(this.polyLabel || "Field Shift")}</name><Placemark><name>${esc(dateStr)}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
      } else if (fmt === "csv") {
        mime = "text/csv;charset=utf-8";
        const stats = this.computeStats(cells);
        const rows = ["cuadro_id,fila,col,lat,lon,lado_m,verdor_ndvi,anomalia_z,cultivo_ia,fecha_escena"];
        cells.forEach((c, idx) => {
          const [[s, w], [n, e]] = c.limites;
          const rowNum = c.fila != null ? c.fila + 1 : Math.floor(idx / sideCount) + 1;
          const colNum = c.col != null ? c.col + 1 : (idx % sideCount) + 1;
          const z = c.ndvi != null ? ((c.ndvi - stats.mean) / stats.sd).toFixed(2) : "";
          const aiC = window.V2.aiResp?.celdas?.[idx]?.clase || "";
          rows.push(`${idx + 1},${rowNum},${colNum},${((s + n) / 2).toFixed(6)},${((w + e) / 2).toFixed(6)},${c.lado_m},${c.ndvi ?? ""},${z},${aiC},${dateStr}`);
        });
        content = rows.join("\n");
      }

      const blob = new Blob([content], { type: mime });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `field_shift_${dateStr}.${ext}`;
      a.click();
    },

    importGeoFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const txt = String(reader.result || "");
          let ring = [];
          if (file.name.toLowerCase().endsWith(".kml") || txt.includes("<coordinates>")) {
            const m = txt.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
            if (m) {
              ring = m[1].trim().split(/\s+/).map(p => {
                const [lo, la] = p.split(",").map(Number);
                return [la, lo];
              }).filter(([la, lo]) => !isNaN(la) && !isNaN(lo));
            }
          } else {
            const j = JSON.parse(txt);
            const geom = j.type === "FeatureCollection" ? j.features?.[0]?.geometry : j.type === "Feature" ? j.geometry : j;
            const coords = geom?.type === "Polygon" ? geom.coordinates[0] : geom?.type === "MultiPolygon" ? geom.coordinates[0][0] : [];
            ring = coords.map(([lo, la]) => [la, lo]);
          }
          if (ring.length < 3) {
            window.V2.showToast("No se encontró un polígono válido.", 4000);
            return;
          }
          this.setPolygonCoords(ring, file.name.replace(/\.[^.]+$/, ""));
          this.analyzeTerrain();
        } catch (err) {
          window.V2.showToast("Error al importar archivo: " + err.message, 4000);
        }
      };
      reader.readAsText(file);
    }
  };

  window.V2Map = V2Map;
})();

