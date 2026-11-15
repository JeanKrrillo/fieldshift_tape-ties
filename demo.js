// =============================================================================
// Field Shift — Modo demo interactivo para presentaciones (NASA Space Apps 2026).
// Un cursor recorre la aplicación de forma realista: inicia sesión, cambia de idioma,
// coloca la ubicación en el mapa, despliega el cuadrante satelital Sentinel-2 L2A,
// prueba los filtros y el zoom/paneo, activa las rutas de muestreo y simula 35 rovers,
// consulta a la SI (Inteligencia Satelital), inspecciona el prototipo físico IoT en vivo
// (reproduciendo las lecturas reales del Google Sheet / AppSheet), explora economía y conceptos.
// Velocidad 100% configurable: 30 segundos (pitch exprés), 90 segundos o 3 minutos.
// =============================================================================
(function () {
  "use strict";
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  const Demo = {
    corriendo: false,
    pausa: false,
    bucle: true,
    ronda: 0,
    cursor: null,
    letrero: null,
    x: +(sessionStorage.getItem("fs_demo_x") || innerWidth - 60),
    y: +(sessionStorage.getItem("fs_demo_y") || 40),

    // Configurador de duración
    duraciones: {
      "30s": { factor: 5.2, limite: 36000, label: "30s" },
      "90s": { factor: 2.1, limite: 96000, label: "90s" },
      "3m":  { factor: 1.0, limite: 185000, label: "3 min" },
    },
    duracionActiva: sessionStorage.getItem("fs_demo_duracion") || "90s",

    factor() {
      return this.duraciones[this.duracionActiva]?.factor || 2.0;
    },

    setDuracion(d) {
      if (this.duraciones[d]) {
        this.duracionActiva = d;
        try { sessionStorage.setItem("fs_demo_duracion", d); } catch (_) {}
        this.pintar();
      }
    },

    // ---------------------------------------------------------------- piezas de control
    async esperar(ms) {
      const f = this.factor();
      const ajustado = Math.max(15, Math.round(ms / f));
      const r = this.ronda, fin = Date.now() + ajustado;
      while (Date.now() < fin || this.pausa) {
        if (r !== this.ronda) throw new Error("reinicio");
        await dormir(40);
      }
    },

    async buscar(sel, ms = 3000) {
      const f = this.factor();
      const ajustado = Math.max(600, Math.round(ms / f));
      const fin = Date.now() + ajustado;
      while (Date.now() < fin) {
        const el = typeof sel === "function" ? sel() : [...document.querySelectorAll(sel)].find(e => e.offsetParent && e.getBoundingClientRect().width);
        if (el) return el;
        await this.esperar(100);
      }
      return null;
    },

    decir(txt) {
      if (!this.letrero) return;
      this.letrero.textContent = txt;
      this.letrero.hidden = !txt;
    },

    // Movimiento con curva y aceleración suave
    async mover(x, y) {
      if (Number.isNaN(x) || x == null) x = innerWidth / 2;
      if (Number.isNaN(y) || y == null) y = innerHeight / 2;
      const targetX = Math.max(16, Math.min(innerWidth - 24, x));
      const targetY = Math.max(16, Math.min(innerHeight - 24, y));
      const f = this.factor();
      const x0 = this.x, y0 = this.y, d = Math.hypot(targetX - x0, targetY - y0);
      const t = Math.max(70, Math.min(900, (240 + d * 0.7) / f)), ini = performance.now();
      const cx = (x0 + targetX) / 2 + (targetY - y0) * 0.18, cy = (y0 + targetY) / 2 - (targetX - x0) * 0.18;
      while (true) {
        if (this.pausa) { await this.esperar(0); continue; }
        const k = Math.min(1, (performance.now() - ini) / t);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        this.x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * targetX;
        this.y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * targetY;
        this.x = Math.max(16, Math.min(innerWidth - 24, this.x));
        this.y = Math.max(16, Math.min(innerHeight - 24, this.y));
        if (this.cursor) {
          this.cursor.hidden = false;
          this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`;
        }
        if (k >= 1) {
          try {
            sessionStorage.setItem("fs_demo_x", Math.round(this.x));
            sessionStorage.setItem("fs_demo_y", Math.round(this.y));
          } catch (_) {}
          break;
        }
        await dormir(16);
      }
    },

    contenedor(el) {
      if (!el) return document.scrollingElement || document.documentElement;
      const oPropio = getComputedStyle(el).overflowY;
      if ((oPropio === "auto" || oPropio === "scroll") && el.scrollHeight > el.clientHeight + 4) return el;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 4) return p;
      }
      return document.scrollingElement || document.documentElement;
    },

    async desplazarSuave(c, targetY, duracionMs = 380) {
      if (!c) return;
      const f = this.factor();
      const inicio = c.scrollTop;
      const maxScroll = Math.max(0, c.scrollHeight - c.clientHeight);
      const fin = Math.max(0, Math.min(maxScroll, Math.round(targetY)));
      const dist = fin - inicio;
      if (Math.abs(dist) < 3) return;

      const dur = Math.max(70, Math.min(800, duracionMs / f));
      const t0 = performance.now();
      while (true) {
        if (this.pausa) { await this.esperar(0); continue; }
        const p = Math.min(1, (performance.now() - t0) / dur);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        c.scrollTop = inicio + dist * e;
        if (p >= 1) break;
        await dormir(16);
      }
      await this.esperar(40);
    },

    async rodar(el, arriba = false) {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: arriba ? "start" : "center", inline: "nearest" });
      } catch (_) {}
      const c = this.contenedor(el), pagina = c === document.scrollingElement || c === document.documentElement;
      const r = el.getBoundingClientRect();
      const v = pagina ? { top: 0, bottom: innerHeight, height: innerHeight } : c.getBoundingClientRect();
      const margenSup = pagina ? 86 : 36;
      const margenInf = pagina ? 50 : 36;

      if (!arriba && r.top >= v.top + margenSup && r.bottom <= v.bottom - margenInf) return;

      let targetScroll;
      if (pagina) {
        const curY = window.scrollY || document.documentElement.scrollTop;
        const elY = r.top + curY;
        targetScroll = (arriba || r.height > (v.height - margenSup - margenInf)) ? (elY - margenSup) : (elY - Math.max(margenSup, (v.height - r.height) / 2));
      } else {
        const diff = r.top - v.top;
        targetScroll = (arriba || r.height > (v.height - margenSup - margenInf)) ? (c.scrollTop + diff - margenSup) : (c.scrollTop + diff - Math.max(margenSup, (v.height - r.height) / 2));
      }
      const dist = Math.abs(targetScroll - c.scrollTop);
      await this.desplazarSuave(c, targetScroll, Math.min(500, Math.max(120, dist * 0.4)));
    },

    async recorrerBloque(el, ms = 2200) {
      if (!el) return;
      const c = this.contenedor(el), pagina = c === document.scrollingElement || c === document.documentElement;
      const alto = pagina ? innerHeight : c.clientHeight;
      const r = el.getBoundingClientRect();
      const sobra = r.height - (alto - 140);
      if (sobra > 25) {
        const targetScroll = Math.min(c.scrollHeight - c.clientHeight, c.scrollTop + sobra);
        await this.desplazarSuave(c, targetScroll, ms * 0.7);
        await this.esperar(Math.max(200, ms * 0.3));
      } else {
        await this.esperar(ms);
      }
    },

    async recorrerEspacio(selWorkspace, texto, ms = 2400) {
      const ws = typeof selWorkspace === "string" ? await this.buscar(selWorkspace, 3000) : selWorkspace;
      if (!ws) return;
      this.decir(texto);
      const c = this.contenedor(ws);
      const maxScroll = c.scrollHeight - c.clientHeight;
      if (maxScroll > 40) {
        const b = ws.getBoundingClientRect();
        await this.mover(Math.min(innerWidth - 220, Math.max(b.left + 90, innerWidth * 0.35)), Math.min(innerHeight - 120, innerHeight * 0.38));
        await this.desplazarSuave(c, maxScroll * 0.85, ms * 0.7);
        await this.esperar(Math.max(250, ms * 0.3));
      } else {
        await this.esperar(ms);
      }
    },

    async irA(el) {
      if (!el) return;
      await this.rodar(el);
      const b = await this.quieto(el);
      const targetX = Math.max(16, Math.min(innerWidth - 24, b.left + Math.max(4, b.width / 2)));
      const targetY = Math.max(16, Math.min(innerHeight - 24, b.top + Math.max(4, b.height / 2)));
      await this.mover(targetX, targetY);
    },

    tarde() {
      // Nunca saltar pasos de forma prematura para garantizar una demo fluida
      return false;
    },

    anotar(texto, ok, motivo) {
      let l; try { l = JSON.parse(sessionStorage.getItem("fs_demo_log") || "[]"); } catch (_) { l = []; }
      const t0 = +(sessionStorage.getItem("fs_demo_t0") || Date.now());
      l.push({ s: Math.round((Date.now() - t0) / 1000), paso: texto, ok, motivo: motivo || null, seccion: window.V2?.space || null });
      try { sessionStorage.setItem("fs_demo_log", JSON.stringify(l)); } catch (_) {}
    },

    async clic(sel, texto, despues = 1400) {
      if (this.tarde()) { this.anotar(texto, false, "sin tiempo"); return false; }
      const el = await this.buscar(sel);
      if (!el) { this.anotar(texto, false, "no apareció: " + (typeof sel === "string" ? sel : "elemento")); return false; }
      this.decir(texto);
      await this.irA(el);
      const fin = await this.quieto(el, 500);
      if (Math.abs(fin.left + fin.width / 2 - this.x) > 3 || Math.abs(fin.top + fin.height / 2 - this.y) > 3) {
        await this.mover(fin.left + fin.width / 2, fin.top + fin.height / 2);
      }
      await this.esperar(150);
      this.pulsar();
      el.focus?.({ preventScroll: true });
      el.click();
      this.anotar(texto, true);
      await this.seguir(sel, el);
      await this.esperar(despues);
      return true;
    },

    pulsar() {
      if (!this.cursor) return;
      this.cursor.classList.add("pulsa");
      setTimeout(() => this.cursor?.classList.remove("pulsa"), 200);
      const onda = document.createElement("div");
      onda.className = "demo-onda";
      onda.style.left = this.x + "px";
      onda.style.top = this.y + "px";
      document.body.appendChild(onda);
      setTimeout(() => onda.remove(), 550);
    },

    async quieto(el, maximo = 1200) {
      let prev = null;
      const fin = Date.now() + maximo;
      while (Date.now() < fin) {
        const r = el.getBoundingClientRect();
        if (prev && Math.abs(r.left - prev.left) < 1 && Math.abs(r.top - prev.top) < 1 && Math.abs(r.width - prev.width) < 1) return r;
        prev = r;
        await this.esperar(60);
      }
      return el.getBoundingClientRect();
    },

    async seguir(sel, el) {
      await this.esperar(90);
      const nuevo = typeof sel === "string" ? [...document.querySelectorAll(sel)].find(e => e.offsetParent) : (el?.isConnected ? el : null);
      if (!nuevo) return;
      const b = await this.quieto(nuevo), x = b.left + b.width / 2, y = b.top + b.height / 2;
      if (Math.abs(x - this.x) > b.width / 2 || Math.abs(y - this.y) > b.height / 2) await this.mover(x, y);
    },

    async escribir(sel, texto, decir) {
      if (this.tarde() || !(await this.clic(sel, decir, 250))) return false;
      const f = this.factor();
      let escrito = "", el = await this.buscar(sel, 2000);
      for (const ch of texto) {
        escrito += ch;
        if (!el?.isConnected) el = await this.buscar(sel, 2000);
        if (!el) return false;
        el.value = escrito;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await dormir(Math.max(10, Math.round((40 + Math.random() * 45) / f)));
        while (this.pausa) await this.esperar(0);
      }
      el = await this.buscar(sel, 2000);
      if (el && el.value !== texto) { el.value = texto; el.dispatchEvent(new Event("input", { bubbles: true })); }
      el?.dispatchEvent(new Event("change", { bubbles: true }));
      this.anotar("escribir: " + texto.slice(0, 20), true);
      await this.esperar(350);
      return true;
    },

    async leer(sel, texto, ms = 2400) {
      if (this.tarde()) { this.anotar(texto, false, "sin tiempo"); return; }
      const el = await this.buscar(sel, 3000);
      if (!el) { this.anotar(texto, false, "no apareció: " + sel); return; }
      this.anotar(texto, true);
      await this.rodar(el, true);
      const t = el.querySelector("h2, h3, .card-title, thead, b") || el, b = await this.quieto(t);
      this.decir(texto);
      await this.mover(Math.min(b.left + 24, b.right), b.top + Math.min(b.height / 2, 14));
      await this.recorrerBloque(el, ms);
    },

    // ---------------------------------------------------------------- acciones del mapa
    async tocarCuadro() {
      const r = await this.buscar(() => window.V2?.terrainResp?.celdas?.length && window.V2Map?.poly && window.V2.space === "mapa" ? window.V2Map.map.getContainer() : null, 15000);
      if (!r) return;
      const mp = window.V2Map.map, cs = window.V2.terrainResp.celdas, c0 = window.V2Map.poly.getBounds().getCenter();
      const idx = cs.reduce((a, c, i) => (Math.hypot(c.lat - c0.lat, c.lon - c0.lng) < Math.hypot(cs[a].lat - c0.lat, cs[a].lon - c0.lng) ? i : a), 0);
      const p = mp.latLngToContainerPoint([cs[idx].lat, cs[idx].lon]), b = mp.getContainer().getBoundingClientRect();
      this.decir("Click one square: its data opens right on the map");
      await this.mover(b.left + p.x, b.top + p.y);
      await this.esperar(200);
      this.pulsar();
      window.V2.selectedCells.clear();
      window.V2.selectedCells.add(idx);
      window.V2Map.drawGridCells();
      window.V2Vivo?.popupCelda(idx);
      this.anotar("tocar un cuadro", !!document.querySelector(".pv-popup"));
      await this.esperar(2600);
    },

    async dibujar(esquinas) {
      const M = window.V2Map, mp = M?.map;
      if (!mp) return;
      mp.setView([(esquinas[0][0] + esquinas[2][0]) / 2, (esquinas[0][1] + esquinas[2][1]) / 2], 18, { animate: false });
      if (!M.drawer) M.startDraw();
      await this.esperar(500);
      const punto = (ll) => { const p = mp.latLngToContainerPoint(ll), r = mp.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; };
      for (const ll of esquinas) {
        const [x, y] = punto(ll);
        await this.mover(x, y);
        await this.esperar(100);
        this.pulsar();
        M.drawer?.addVertex(L.latLng(ll[0], ll[1]));
        await this.esperar(350);
      }
      const [x, y] = punto(esquinas[0]);
      this.decir("Click the first corner again to close the shape");
      await this.mover(x, y);
      await this.esperar(150);
      this.pulsar();
      M.drawer?.completeShape();
      await this.esperar(600);
      this.anotar("dibujar el terreno", !!M.poly, M.poly ? null : "no se cerró la figura");
    },

    // ---------------------------------------------------------------- primera vez: crear o elegir terreno
    async primerTerreno() {
      // Si el terreno ya está cargado con cuadrícula en el mapa, simplemente enfocar y continuar
      if (window.V2Map?.poly && window.V2?.terrainResp?.celdas?.length) {
        if (window.V2.space !== "mapa") window.V2.setSpace("mapa");
        window.V2.setSheetSnap?.("min");
        window.V2Map.map?.fitBounds(window.V2Map.poly.getBounds().pad(0.35), { animate: true });
        return;
      }

      if (!(await this.buscar("#v2-ub-search-q", 3000))) await this.clic('[data-action="abrir-ubicacion"]', "Add your field: search by town or coordinates", 1000);
      if (!(await this.buscar("#v2-ub-search-q", 3000))) return;
      this.decir("New user setup: define the field location");
      await this.esperar(800);
      await this.escribir("#v2-ub-search-q", "Ames, Iowa", "Search for the town where the field is");
      await this.clic("#v2-btn-ub-buscar", "Search place", 500);
      if (await this.buscar("[data-geo-pick]", 4000)) await this.clic("[data-geo-pick]", "Select the exact field coordinates", 1000);
      await this.clic("#v2-ub-btn-draw", "Draw parcel boundary: click each corner on the map", 700);
      await this.dibujar([[42.1049, -93.6055], [42.1049, -93.6045], [42.1041, -93.6045], [42.1041, -93.6055]]);
      if (window.V2Ubicacion?.volverTrasDibujo) window.V2Ubicacion.volverTrasDibujo();
      await this.buscar("#v2-ub-nombre", 4000);
      await this.esperar(400);
      const sel = await this.buscar("#v2-ub-cultivo-act");
      if (sel) {
        await this.clic("#v2-ub-cultivo-act", "Select active crop", 300);
        const s2 = document.getElementById("v2-ub-cultivo-act");
        if (s2) { s2.value = s2.options[1]?.value || ""; s2.dispatchEvent(new Event("change", { bubbles: true })); }
        await this.esperar(600);
      }
      await this.escribir("#v2-ub-nombre", "North field", "Assign field name");
      await this.clic("#v2-btn-ub-continuar", "Save parcel: Sentinel-2 and NASA data load automatically", 1200);
      if (await this.buscar('.modal-card [data-close-modal]', 2500)) await this.clic('.modal-card [data-close-modal]', "Skip sensor pairing for now", 600);
      await this.buscar(() => window.V2?.terrainResp?.celdas?.length && !window.V2.modal ? document.body : null, 15000);

      // Pasar DIRECTAMENTE al mapa interactivo del terreno creado
      if (window.V2.modal) window.V2.closeModal();
      window.V2.setSpace("mapa");
      window.V2.setSheetSnap?.("min");
      document.getElementById("v2-toast-progress")?.setAttribute("hidden", "true");
      document.querySelectorAll(".vivo-aviso").forEach(e => e.remove());
      if (window.V2Map?.poly) window.V2Map.map?.fitBounds(window.V2Map.poly.getBounds().pad(0.35), { animate: false });
      await this.esperar(600);
    },

    // ---------------------------------------------------------------- EL RECORRIDO COMPLETO
    async recorrido() {
      const V = window.V2;

      // 1. EL MAPA Y CONDICIONES EN VIVO
      if (V.space !== "mapa") V.setSpace("mapa");
      window.V2.setSheetSnap?.("min");
      document.getElementById("v2-toast-progress")?.setAttribute("hidden", "true");
      document.querySelectorAll(".vivo-aviso").forEach(e => e.remove());
      if (window.V2Map?.poly) window.V2Map.map?.fitBounds(window.V2Map.poly.getBounds().pad(0.35), { animate: false });
      this.decir("Interactive satellite map: North field at 10 m Sentinel-2 resolution");
      await this.esperar(1000);

      // Ver tablero del clima y satélite arriba del mapa
      await this.leer("#campo-tablero", "Live conditions: air temp, wind vector, humidity and Sentinel-2 NDVI", 1800);

      // 2. EXPLORAR FILTROS, ZOOM Y PANEO DEL MAPA
      await this.clic('[data-color-mode="sev"]', "Filter: Risk highlights severe water stress and frost danger", 1400);

      // Paneo suave del mapa
      if (window.V2Map?.map) {
        this.decir("Explore and pan across different sectors of the parcel");
        await this.mover(innerWidth * 0.5, innerHeight * 0.45);
        this.pulsar();
        window.V2Map.map.panBy([35, -25], { animate: true, duration: 0.6 });
        await this.esperar(800);
      }

      // Zoom in y zoom out
      if (window.V2Map?.map) {
        this.decir("Zoom in to inspect individual 10-meter agricultural cells");
        window.V2Map.map.zoomIn(1);
        await this.esperar(800);
        window.V2Map.map.zoomOut(1);
        await this.esperar(700);
        if (window.V2Map.map.getZoom() < 14) window.V2Map.map.setZoom(15);
      }

      // Filtro de 3 Zonas
      await this.clic('[data-color-mode="zones"]', "Filter: 3 management zones grouped by agronomic behavior", 1400);

      // Explorar capas satelitales NASA (temperatura / cultivo)
      const capaChip = document.querySelector("[data-campo-capa]");
      if (capaChip) {
        await this.clic("[data-campo-capa]", "Turn on NASA satellite layer: surface temperature / croplands", 1500);
        await this.clic("[data-campo-capa].on", "Toggle layer back to field view", 800);
      }

      // Volver a Verdor (ndvi)
      await this.clic('[data-color-mode="ndvi"]', "Field Greenness: 10 m Sentinel-2 vegetative index", 1200);

      // 3. RUTAS SUGERIDAS DE MUESTREO Y SIMULACIÓN DE FLOTA DE ROVERS
      await this.clic("[data-vivo-ruta]", "Optimal rover sampling route generated across low-vigor squares", 1600);
      await this.clic("[data-vivo-sim]", "Simulate fleet of 35 rovers scanning the parcel", 1200);

      // Dejar que los robots se muevan por el terreno y la cámara/cursor los sigue
      this.decir("Fleet of 35 rovers moving autonomously reading real-time NDVI");
      const rCenter = window.V2Map?.poly?.getBounds?.().getCenter?.();
      if (rCenter && window.V2Map?.map) {
        window.V2Map.map.panTo(rCenter, { animate: true, duration: 0.8 });
        if (window.V2Map.map.getZoom() < 14) window.V2Map.map.setZoom(15);
        const mp = window.V2Map.map, p = mp.latLngToContainerPoint(rCenter), b = mp.getContainer().getBoundingClientRect();
        await this.mover(b.left + p.x, b.top + p.y);
      }
      await this.esperar(2200);

      // 4. PROBAR LA SI (INTELIGENCIA SATELITAL)
      await this.clic(".si-fab, [data-action=\"abrir-si\"]", "Ask Field SI: satellite agronomic AI assistant", 1200);
      const siChip1 = await this.buscar(".si-chip-btn, [data-si-q]", 1500);
      if (siChip1) {
        await this.clic(siChip1, "Ask: Was there frost this week?", 2400);
      }
      const siChip2 = document.querySelectorAll(".si-chip-btn, [data-si-q]")[1];
      if (siChip2) {
        await this.clic(siChip2, "Ask: How is soil moisture?", 2400);
      }
      await this.clic("#v2-si-cerrar", "Close SI panel and continue exploring", 700);

      // 5. INSPECCIONAR EL ROBOT EN VIVO (HARDWARE REAL + STREAMING GOOGLE SHEETS)
      await this.clic('[data-go-space="inicio"]', "Inspect live robot telemetry from physical IoT prototype", 1400);
      if (V.space !== "inicio") V.setSpace("inicio");
      await this.esperar(500);

      // Video de pruebas de hardware real en bucle
      await this.leer(".rover-hardware-card", "Looping physical test videos of the miniature IoT rover", 2200);
      const vidBtn2 = await this.buscar('[data-vid-src*="rover_prueba_2"]', 1200);
      if (vidBtn2) {
        await this.clic(vidBtn2, "Switch camera: physical field trial vs laboratory bench test", 1500);
      }

      // STREAMING EN TIEMPO REAL DE LA HOJA DE GOOGLE
      await this.leer(".rover-stream-player", "Live streaming ingest: stepping through actual Google Sheets (AppSheet) logs", 2000);
      const btnNext = await this.buscar("#rover-btn-next", 1000);
      if (btnNext) {
        await this.clic("#rover-btn-next", "Advance live sample: updates speed, rotation, temp & humidity", 1200);
        await this.clic("#rover-btn-next", "Next reading: real recorded Querétaro prototype telemetry", 1200);
      }

      // Comparativa Lado a Lado: Sensor de Hardware vs Nube NASA
      await this.leer(".side-by-side-card", "Local hardware sensor vs Sentinel-2 / NASA POWER regional cloud average", 2200);

      // Tabla de datos en crudo
      await this.recorrerEspacio("#v2-ws-inicio", "Raw telemetry log table highlighting each streaming row", 2200);

      // Sección de conexión del robot (sincronización con Google Sheets)
      await this.clic('[data-go-space="robot"]', "Robot settings: Google Sheets live sync, intervals and tokens", 1500);
      await this.leer("#v2-ws-robot .card", "Sync status: last read, rows stored and next sync interval", 1600);

      // Detener simulación de robots
      window.V2Vivo?.parar?.();

      // 6. ECONOMÍA Y PLANIFICACIÓN DE CULTIVOS
      await this.clic('[data-go-space="decidir"]', "Economics: live USDA market prices and crop profitability", 1500);
      const yaHabia = { ...(V.farmExtra || {}) };
      await this.escribir('[data-calc="costMaize"]', "420", "Input estimated production cost per hectare ($420/ha)");
      await this.escribir('[data-calc="yieldMaize"]', "10.2", "Input expected crop yield (10.2 t/ha)");
      await this.recorrerEspacio("#v2-ws-decidir", "Dynamic profitability calculator with live USDA MARS market prices", 2200);
      Object.assign(V.farmExtra, { costMaize: yaHabia.costMaize ?? null, yieldMaize: yaHabia.yieldMaize ?? null });
      try { localStorage.setItem("v2_farm_extra", JSON.stringify(V.farmExtra)); } catch (_) {}

      // 7. SECCIÓN DE CONCEPTOS AGRONÓMICOS
      await this.clic('[data-go-space="conceptos"]', "Concepts: 17 agronomic topics explained simply with live search", 1500);
      await this.escribir("#v2-con-search-q", "NDVI", "Search what NDVI (Vegetation Index) means");
      await this.leer(".concepto-card-exp, .card", "NDVI definition, satellite bands, and practical farm recommendations", 2200);

      // 8. REGRESO AL MAPA Y CONCLUSIÓN
      await this.clic('[data-go-space="mapa"]', "Field Shift: complete end-to-end satellite & robotics platform", 1400);
      if (V.space !== "mapa") V.setSpace("mapa");
      this.decir(window.V2?.lang === "en" ? "✓ Demo finished: North field satellite & IoT rover tour complete!"
        : window.V2?.lang === "pt" ? "✓ Demonstração concluída: mapa de satélite e robô IoT inspecionados!"
        : "✓ ¡Demo completada con éxito: satélite Sentinel-2 y telemetría de rover!");
      await this.esperar(2500);
    },

    // ---------------------------------------------------------------- control de sesión
    fase(v) {
      try {
        if (v === undefined) return sessionStorage.getItem("fs_demo");
        if (v) sessionStorage.setItem("fs_demo", v);
        else sessionStorage.removeItem("fs_demo");
      } catch (_) {}
      return null;
    },

    async salir() {
      try {
        sessionStorage.setItem("fs_demo_t0", Date.now());
        sessionStorage.removeItem("fs_demo_log");
      } catch (_) {}
      this.fase("entrar");
      window.V2?.closeModal?.();
      await this.clic('[data-action="abrir-cuenta"]', "Start from the sign-in screen", 700);
      window.V2?.closeModal?.();
      await window.V2Cuenta.cerrarSesion();
    },

    mascara() {
      const k = document.getElementById("v2-inp-pass"), f = document.getElementById("v2-cuenta-form");
      if (k) { k.type = "text"; k.autocomplete = "off"; k.classList.add("demo-mascara"); }
      if (f) f.setAttribute("autocomplete", "off");
    },

    async entrar() {
      const cred = await (await fetch("/api/v1/cuenta/demo?reiniciar=1", { credentials: "same-origin" })).json();
      try { localStorage.removeItem("v2_last_terrain"); localStorage.removeItem("v2_farm_extra"); } catch (_) {}
      if (cred.estado !== "OK") { this.decir(cred.detalle || "Demo account not available"); this.fase(null); return; }
      await this.buscar("#v2-cuenta-form", 10000);
      await this.esperar(400);

      // Cambio de idioma (Inglés y Español)
      await this.clic('.auth-lang [data-set-lang="en"]', "Field Shift opens in English, Spanish or Portuguese", 1400);
      await this.clic('.auth-lang [data-set-lang="es"]', "Interfaz completamente trilingüe sin recargar", 1000);

      // Iniciar sesión
      await this.clic('[data-cuenta-tab="entrar"]', "Sign in", 600);
      await this.escribir("#v2-inp-correo", cred.correo, "Type the email");
      this.mascara();
      await this.escribir("#v2-inp-pass", cred.contrasena, "And the password (demo account)");
      await this.esperar(300);
      this.mascara();
      this.fase("recorrido");
      await this.clic(".auth-submit", "Sign in: your field and its data load on their own", 3500);
    },

    async correr() {
      if (this.corriendo) return;
      this.corriendo = true;
      try { sessionStorage.setItem("fs_demo_t0", Date.now()); } catch (_) {}
      if (this.cursor) this.cursor.hidden = false;
      this.pintar();
      document.body.classList.add("demo-activo");
      try {
        const sesion = !!window.V2Adapter?.obtenerSesion();
        const f = this.fase();
        if (!f) try { sessionStorage.setItem("fs_demo_t0", Date.now()); sessionStorage.removeItem("fs_demo_log"); } catch (_) {}
        if (f === "entrar" || (!f && !sesion)) await this.entrar();
        else if (!f && sesion) await this.salir();
        else if (f === "recorrido") {
          try { sessionStorage.setItem("fs_demo_t0", Date.now()); } catch (_) {}
          await this.esperar(1000);
          await this.primerTerreno();
          await this.recorrido();
          await this.esperar(1200);
          if (this.bucle) {
            try { sessionStorage.removeItem("fs_demo_t0"); } catch (_) {}
            await this.salir();
          } else {
            this.fase(null);
          }
        }
      } catch (e) {
        if (e.message !== "reinicio") console.warn("demo:", e);
      }
      document.body.classList.remove("demo-activo");
      this.corriendo = false;
      this.pausa = false;
      if (this.cursor) {
        // Estacionar el cursor suavemente en el control superior sin desaparecer de golpe
        await this.mover(innerWidth - 120, 26);
        setTimeout(() => {
          if (!this.corriendo && this.cursor) this.cursor.hidden = true;
        }, 3000);
      }
      this.decir("");
      this.pintar();
    },

    reiniciar() {
      this.ronda++;
      this.pausa = false;
      this.fase(null);
      window.V2Vivo?.parar?.();
      if (window.V2SI?.abierto) document.getElementById("v2-si-cerrar")?.click();
      setTimeout(() => { this.corriendo = false; this.correr(); }, 150);
    },

    pintar() {
      if (!this.caja) return;
      const d = this.duracionActiva;
      this.caja.innerHTML = `
        <button type="button" data-demo="mini" class="demo-mini" aria-label="Demo controls" aria-expanded="${this.abierta}">${this.corriendo && !this.pausa ? "●" : "▶"}</button>
        ${this.abierta ? `<div class="demo-ctl">
          <div class="demo-speed-row">
            <button type="button" class="demo-dur-btn ${d === "30s" ? "active" : ""}" data-demo-dur="30s">⚡ 30s</button>
            <button type="button" class="demo-dur-btn ${d === "90s" ? "active" : ""}" data-demo-dur="90s">🎯 90s</button>
            <button type="button" class="demo-dur-btn ${d === "3m" ? "active" : ""}" data-demo-dur="3m">🎬 3m</button>
          </div>
          <button type="button" data-demo="play">${this.corriendo && !this.pausa ? "❚❚ Pause" : this.corriendo ? "▶ Resume" : "▶ Start demo"}</button>
          <button type="button" data-demo="reset">↺ Restart</button>
          <button type="button" data-demo="stop">■ Stop</button>
          <label style="display:flex;align-items:center;gap:3px;font-size:11px"><input type="checkbox" data-demo="loop" ${this.bucle ? "checked" : ""}> Loop</label>
        </div>` : ""}`;
    },

    init() {
      this.caja = document.createElement("div"); this.caja.id = "demo-caja";
      this.cursor = document.createElement("div"); this.cursor.id = "demo-cursor"; this.cursor.hidden = true;
      this.cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2l7.5 19 2.6-7.4L20.5 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      this.letrero = document.createElement("div"); this.letrero.id = "demo-letrero"; this.letrero.hidden = true; this.letrero.setAttribute("aria-live", "polite");
      document.body.append(this.caja, this.cursor, this.letrero);
      this.abierta = false;
      this.pintar();

      this.caja.addEventListener("click", (e) => {
        const dur = e.target.closest("[data-demo-dur]")?.dataset.demoDur;
        if (dur) {
          this.setDuracion(dur);
          return;
        }
        const a = e.target.closest("[data-demo]")?.dataset.demo;
        if (a === "mini") { this.abierta = !this.abierta; this.pintar(); }
        else if (a === "play") { if (!this.corriendo) this.correr(); else { this.pausa = !this.pausa; this.pintar(); } }
        else if (a === "stop") { this.ronda++; this.fase(null); }
        else if (a === "reset") this.reiniciar();
      });

      this.caja.addEventListener("change", (e) => {
        if (e.target.dataset.demo === "loop") {
          this.bucle = e.target.checked;
          try { sessionStorage.setItem("fs_demo_bucle", this.bucle ? "1" : "0"); } catch (_) {}
        }
      });

      try { if (sessionStorage.getItem("fs_demo_bucle") === "0") this.bucle = false; } catch (_) {}
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.corriendo) { this.ronda++; this.fase(null); }
      });

      if (this.fase()) {
        this.cursor.hidden = false;
        this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`;
        setTimeout(() => this.correr(), 600);
      }
    },
  };

  window.FSDemo = Demo;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Demo.init());
  } else {
    Demo.init();
  }
})();
